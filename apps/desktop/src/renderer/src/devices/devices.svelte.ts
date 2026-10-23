import { TimeWindowAverage } from '@cyclotron/core'
import { errorText } from '../i18n/errors'
import { t } from '../i18n/t'
import { logEvent } from '../lib/diag'
import { loadPref, savePref } from '../lib/prefs'
import { BleHeartRate, HEART_RATE_SERVICES } from './ble-heart-rate'
import type { ZwiftButton } from '@cyclotron/core'
import { CpsTrainer } from './cps-trainer'
import { Emitter } from './emitter'
import { CONTROLLER_SERVICES, controllerLabel, ZwiftController } from './zwift-controller'
import { FtmsTrainer, TRAINER_SERVICES } from './ftms-trainer'
import { SimulatedTrainer } from './simulated'
import type { HeartRateSource, LinkStatus, Trainer, TrainerControl, TrainerData } from './types'

type Role = 'trainer' | 'heartRate' | 'controller'

const REMEMBERED_KEY = 'cyclotron.devices'

/** Device names to auto-pick on the next connect (E1-5). Names, not ids: Electron's scan ids and
 * Web Bluetooth's `device.id` differ, and "KICKR CORE 8E84" is unique enough. */
function loadRemembered(): Partial<Record<Role, string>> {
  return loadPref<Partial<Record<Role, string>>>(REMEMBERED_KEY) ?? {}
}

/** App-wide device state: the connected trainer and HR source, and their latest values. */

const CONTROLLERS_KEY = 'cyclotron.controllers'

/** A controller to reconnect: by address when known (a Play's two halves share one name). */
export interface RememberedController {
  name: string
  address?: string
}

/** Older versions stored plain names. */
function loadRememberedControllers(): RememberedController[] {
  const raw = loadPref<(string | RememberedController)[]>(CONTROLLERS_KEY) ?? []
  return raw.map((r) => (typeof r === 'string' ? { name: r } : r))
}

function sameController(a: RememberedController, b: RememberedController): boolean {
  return a.address && b.address ? a.address === b.address : a.name === b.name
}

export const rememberedLabel = (r: RememberedController): string =>
  controllerLabel(r.name, r.address)

/** FTMS first; a device without it (a power meter, an older trainer) falls back to CPS. */
async function connectTrainerDevice(device: BluetoothDevice): Promise<Trainer> {
  try {
    return await FtmsTrainer.connect(device)
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'NotFoundError')) throw e
    return await CpsTrainer.connect(device)
  }
}

class Devices {
  trainer = $state.raw<Trainer | undefined>()
  heartRate = $state.raw<HeartRateSource | undefined>()
  trainerStatus = $state<LinkStatus>('connected')
  heartRateStatus = $state<LinkStatus>('connected')
  data = $state.raw<TrainerData | undefined>()
  bpm = $state<number | undefined>()
  control = $state.raw<TrainerControl>({ kind: 'free' })
  /** Which device is being connected; the picker is open while `picking`. */
  connecting = $state<Role | undefined>()
  picking = $state(false)
  error = $state<string | undefined>()
  remembered = $state(loadRemembered())
  /** Zwift Play / Click / Ride controllers (buttons); a Play is two devices. */
  controllers = $state.raw<ZwiftController[]>([])
  rememberedControllers = $state<RememberedController[]>(
    loadRememberedControllers().filter((c) => !this.isTrainerOrStrap(c.name)),
  )
  /** Last button pressed, for the tester in Settings. */
  lastPress = $state<{ button: ZwiftButton; from: string; at: number } | undefined>()
  /** Every controller button press (the Ride screen listens). */
  readonly presses = new Emitter<ZwiftButton>()
  /** `performance.now()` of the latest trainer data / heart rate, to spot stale values. */
  dataAt = 0
  bpmAt = 0
  /** Power averaged over the notifications of the last 3 s / 10 s (E4-1). */
  power3s = $state<number | undefined>()
  power10s = $state<number | undefined>()
  private avg3s = new TimeWindowAverage(3000)
  private avg10s = new TimeWindowAverage(10_000)

  private trainerSubs: (() => void)[] = []
  private heartRateSubs: (() => void)[] = []

  async connectSimulated(): Promise<void> {
    await this.disconnectTrainer()
    await this.disconnectHeartRate()
    const sim = new SimulatedTrainer()
    this.attachTrainer(sim)
    this.attachHeartRate(sim.heartRate)
  }

  /**
   * Opens the device picker (auto-picking `name` if given) and connects the trainer: over FTMS,
   * or read-only over the Cycling Power Service when it has no FTMS (E1-3).
   */
  async connectTrainer(name?: string): Promise<void> {
    await this.connect('trainer', TRAINER_SERVICES, name, async (device) => {
      const trainer = await connectTrainerDevice(device)
      await this.disconnectTrainer()
      this.attachTrainer(trainer)
    })
  }

  /** Adds a controller (picker, or straight to a remembered one, by address when known). */
  async connectController(known?: RememberedController): Promise<void> {
    const prefer = known ? (known.address ?? known.name) : undefined
    await this.connect('controller', CONTROLLER_SERVICES, prefer, async (device, address) => {
      // The KICKR CORE 2 also has the Zwift service. One BLE device is one GATT link, so a
      // controller on it would share (and on disconnect, drop) the trainer's connection.
      if (device.name && this.isTrainerOrStrap(device.name)) {
        throw new Error(t().controllers.notTrainer(device.name))
      }
      const c = await ZwiftController.connect(device, address)
      // Reconnecting the same unit replaces it; a Play's other half (same name) is added.
      const same = this.controllers.find((x) => sameController(x, c))
      if (same) await this.disconnectController(same)
      c.presses.on((button) => {
        this.lastPress = { button, from: c.label, at: Date.now() }
        this.presses.emit(button)
      })
      this.controllers = [...this.controllers, c]
      const entry = { name: c.name, address: c.address }
      this.rememberedControllers = [
        ...this.rememberedControllers.filter((r) => !sameController(r, entry)),
        entry,
      ]
      savePref(CONTROLLERS_KEY, this.rememberedControllers)
    })
  }

  private isTrainerOrStrap(name: string): boolean {
    return [
      this.trainer?.name,
      this.heartRate?.name,
      this.remembered.trainer,
      this.remembered.heartRate,
    ].includes(name)
  }

  async disconnectController(c: ZwiftController): Promise<void> {
    this.controllers = this.controllers.filter((x) => x !== c)
    await c.disconnect()
  }

  forgetController(known: RememberedController): void {
    this.rememberedControllers = this.rememberedControllers.filter((r) => !sameController(r, known))
    savePref(CONTROLLERS_KEY, this.rememberedControllers)
  }

  async connectHeartRate(name?: string): Promise<void> {
    await this.connect('heartRate', HEART_RATE_SERVICES, name, async (device) => {
      const source = await BleHeartRate.connect(device)
      await this.disconnectHeartRate()
      this.attachHeartRate(source)
    })
  }

  async setControl(control: TrainerControl): Promise<void> {
    this.control = control
    try {
      await this.trainer?.setControl(control)
      this.error = undefined
    } catch (e) {
      this.error = errorText(e)
      logEvent('error', `devices: ${this.error}`)
    }
  }

  async disconnectTrainer(): Promise<void> {
    const trainer = this.trainer
    if (!trainer) return
    // A heart rate relayed by the trainer goes with it.
    if (this.heartRate === trainer.heartRate) await this.disconnectHeartRate()
    for (const u of this.trainerSubs) u()
    this.trainerSubs = []
    this.trainer = undefined
    this.data = undefined
    this.clearAverages()
    this.control = { kind: 'free' }
    await trainer.disconnect()
  }

  async disconnectHeartRate(): Promise<void> {
    const source = this.heartRate
    if (!source) return
    for (const u of this.heartRateSubs) u()
    this.heartRateSubs = []
    this.heartRate = undefined
    this.bpm = undefined
    await source.disconnect()
  }

  forget(role: Role): void {
    const rest = { ...this.remembered }
    delete rest[role]
    this.remember(rest)
  }

  private async connect(
    role: Role,
    optionalServices: BluetoothServiceUUID[],
    name: string | undefined,
    open: (device: BluetoothDevice, address: string | undefined) => Promise<void>,
  ): Promise<void> {
    if (this.connecting) return
    this.connecting = role
    this.error = undefined
    try {
      const device = await this.pick(optionalServices, name)
      if (!device) return
      const address = (await window.cyclotron.bluetooth.lastPicked()) ?? undefined
      await open(device, address)
      if (device.name && role !== 'controller') {
        this.remember({ ...this.remembered, [role]: device.name })
      }
    } catch (e) {
      this.error = errorText(e)
      logEvent('error', `devices: ${this.error}`)
    } finally {
      this.connecting = undefined
    }
  }

  /** Must run from a click handler: Web Bluetooth needs a user gesture. */
  private async pick(
    optionalServices: BluetoothServiceUUID[],
    name: string | undefined,
  ): Promise<BluetoothDevice | undefined> {
    this.picking = true
    void window.cyclotron.bluetooth.preferDevice(name ?? null)
    try {
      return await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices })
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'NotFoundError')) throw e
      // No adapter (or BlueZ not running on Linux) rejects the same way as a cancelled picker.
      if (!(await navigator.bluetooth.getAvailability().catch(() => true)))
        throw Object.assign(new Error('Bluetooth is not available'), { code: 'noBluetooth' })
      return undefined
    } finally {
      this.picking = false
      void window.cyclotron.bluetooth.preferDevice(null)
    }
  }

  private attachTrainer(trainer: Trainer): void {
    this.trainer = trainer
    this.trainerStatus = 'connected'
    this.trainerSubs.push(
      trainer.onData((d) => {
        const now = performance.now()
        this.data = d
        this.dataAt = now
        this.avg3s.add(now, d.powerW)
        this.avg10s.add(now, d.powerW)
        this.power3s = this.avg3s.average(now)
        this.power10s = this.avg10s.average(now)
      }),
      trainer.onStatus((s) => (this.trainerStatus = s)),
      trainer.onDisconnect(() => {
        this.trainer = undefined
        this.data = undefined
        this.clearAverages()
      }),
    )
    // Use the trainer's relayed heart rate once it sends any, unless a strap is connected.
    const relayed = trainer.heartRate
    if (relayed && !this.heartRate) {
      const stop = relayed.onHeartRate(() => {
        stop()
        if (this.trainer === trainer && !this.heartRate) this.attachHeartRate(relayed)
      })
      this.trainerSubs.push(stop)
    }
  }

  private attachHeartRate(source: HeartRateSource): void {
    this.heartRate = source
    this.heartRateStatus = 'connected'
    this.heartRateSubs.push(
      source.onHeartRate((bpm) => {
        this.bpm = bpm
        this.bpmAt = performance.now()
      }),
      source.onStatus((s) => (this.heartRateStatus = s)),
    )
  }

  private clearAverages(): void {
    this.avg3s.clear()
    this.avg10s.clear()
    this.power3s = undefined
    this.power10s = undefined
  }

  private remember(value: Partial<Record<Role, string>>): void {
    this.remembered = value
    savePref(REMEMBERED_KEY, value)
  }
}

export const devices = new Devices()
