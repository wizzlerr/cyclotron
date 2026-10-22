import { GATT, parseHeartRateMeasurement } from '@cyclotron/core'
import { BleLink } from './ble-link'
import { Emitter } from './emitter'
import type { HeartRateSource, LinkStatus } from './types'
import { t } from '../i18n/t'

export const HEART_RATE_SERVICES: BluetoothServiceUUID[] = [GATT.heartRate]

/** A Bluetooth heart rate strap (E1-4). */
export class BleHeartRate implements HeartRateSource {
  readonly name: string
  private link: BleLink
  private hr = new Emitter<number>()

  private constructor(device: BluetoothDevice) {
    this.name = device.name ?? t().app.devices.heartRate
    this.link = new BleLink(
      device,
      (server) => this.setup(server),
      () => {},
    )
  }

  static async connect(device: BluetoothDevice): Promise<BleHeartRate> {
    const source = new BleHeartRate(device)
    await source.link.open()
    return source
  }

  onHeartRate(listener: (bpm: number) => void): () => void {
    return this.hr.on(listener)
  }

  onStatus(listener: (status: LinkStatus) => void): () => void {
    return this.link.status.on(listener)
  }

  async disconnect(): Promise<void> {
    this.link.close()
    this.hr.clear()
  }

  private async setup(server: BluetoothRemoteGATTServer): Promise<void> {
    const service = await server.getPrimaryService(GATT.heartRate)
    const hrm = await service.getCharacteristic(GATT.heartRateMeasurement)
    hrm.oncharacteristicvaluechanged = () => {
      if (hrm.value) this.hr.emit(parseHeartRateMeasurement(hrm.value).bpm)
    }
    await hrm.startNotifications()
  }
}
