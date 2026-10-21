import { TimeWindowAverage } from '@cyclotron/core'
import { BleHeartRate, HEART_RATE_SERVICES } from './ble-heart-rate'
import { FtmsTrainer, TRAINER_SERVICES } from './ftms-trainer'
import { SimulatedTrainer } from './simulated'
import type { HeartRateSource, LinkStatus, Trainer, TrainerControl, TrainerData } from './types'

type Role = 'trainer' | 'heartRate'

const REMEMBERED_KEY = 'cyclotron.devices'

/** Device names to auto-pick on the next connect (E1-5). Names, not ids: Electron's scan ids and
 * Web Bluetooth's `device.id` differ, and "KICKR CORE 8E84" is unique enough. */
function loadRemembered(): Partial<Record<Role, string>> {
  try {
    return JSON.parse(localStorage.getItem(REMEMBERED_KEY) ?? '{}') as Partial<Record<Role, string>>
  } catch {
    return {}
  }
}

/** App-wide device state: the connected trainer and HR source, and their latest values. */
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

  /** Opens the device picker (auto-picking `name` if given) and connects the trainer over FTMS. */
  async connectTrainer(name?: string): Promise<void> {
    await this.connect('trainer', TRAINER_SERVICES, name, async (device) => {
      const trainer = await FtmsTrainer.connect(device)
      await this.disconnectTrainer()
      this.attachTrainer(trainer)
    })
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
      this.error = message(e)
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
    open: (device: BluetoothDevice) => Promise<void>,
  ): Promise<void> {
    if (this.connecting) return
    this.connecting = role
    this.error = undefined
    try {
      const device = await this.pick(optionalServices, name)
      if (!device) return
      await open(device)
      if (device.name) this.remember({ ...this.remembered, [role]: device.name })
    } catch (e) {
      this.error = message(e)
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
      if (e instanceof DOMException && e.name === 'NotFoundError') return undefined
      throw e
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
    try {
      localStorage.setItem(REMEMBERED_KEY, JSON.stringify(value))
    } catch {
      // Not critical: the user picks from the list again.
    }
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export const devices = new Devices()
