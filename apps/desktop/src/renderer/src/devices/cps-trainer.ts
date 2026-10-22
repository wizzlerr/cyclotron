import { GATT, parseCyclingPowerMeasurement, RevolutionRate, wheelRpmToKmh } from '@cyclotron/core'
import { t } from '../i18n/t'
import { logEvent, traceBle } from '../lib/diag'
import { BleLink } from './ble-link'
import { Emitter } from './emitter'
import type { LinkStatus, Trainer, TrainerCapabilities, TrainerData } from './types'

/**
 * A trainer or power meter with only the Cycling Power Service (E1-3): read-only. Power comes
 * straight from it; cadence and speed from its crank and wheel counters. It can't set
 * resistance, so workouts show their targets and the rider rides to them.
 */
export class CpsTrainer implements Trainer {
  readonly kind = 'cps'
  readonly name: string
  private link: BleLink
  private data = new Emitter<TrainerData>()
  private disconnected = new Emitter<void>()
  private crank = new RevolutionRate(1024, 65_536)
  private wheel = new RevolutionRate(2048, 2 ** 32)

  private constructor(device: BluetoothDevice) {
    this.name = device.name ?? t().app.devices.trainer
    this.link = new BleLink(
      device,
      (server) => this.setup(server),
      () => {},
    )
  }

  static async connect(device: BluetoothDevice): Promise<CpsTrainer> {
    const trainer = new CpsTrainer(device)
    await trainer.link.open()
    return trainer
  }

  onData(listener: (data: TrainerData) => void): () => void {
    return this.data.on(listener)
  }

  onDisconnect(listener: () => void): () => void {
    return this.disconnected.on(listener)
  }

  onStatus(listener: (status: LinkStatus) => void): () => void {
    return this.link.status.on(listener)
  }

  /** Nothing to control; the Ride screen tells the rider to ride to the targets. */
  async setControl(): Promise<void> {}

  capabilities(): TrainerCapabilities {
    return { erg: false, resistance: false, simulation: false, calibration: false }
  }

  async disconnect(): Promise<void> {
    this.link.close()
    this.disconnected.emit()
    this.data.clear()
    this.disconnected.clear()
  }

  private async setup(server: BluetoothRemoteGATTServer): Promise<void> {
    const service = await server.getPrimaryService(GATT.cyclingPower)
    const measurement = await service.getCharacteristic(GATT.cyclingPowerMeasurement)
    measurement.oncharacteristicvaluechanged = () => {
      if (!measurement.value) return
      traceBle(this.name, 'cps', measurement.value)
      const m = parseCyclingPowerMeasurement(measurement.value)
      const now = performance.now()
      this.data.emit({
        powerW: Math.max(0, m.powerW),
        cadenceRpm: m.crank ? Math.round(this.crank.update(m.crank.revs, m.crank.time, now)) : 0,
        speedKmh: m.wheel
          ? Math.round(wheelRpmToKmh(this.wheel.update(m.wheel.revs, m.wheel.time, now)) * 10) / 10
          : 0,
      })
    }
    await measurement.startNotifications()
    logEvent('info', `${this.name}: connected over Cycling Power (no FTMS, read-only)`)
  }
}
