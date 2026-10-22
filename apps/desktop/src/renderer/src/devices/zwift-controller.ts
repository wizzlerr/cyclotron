import {
  RIDE_ON,
  ZWIFT_ASYNC,
  ZWIFT_RIDE_SERVICE,
  ZWIFT_SERVICE,
  ZWIFT_SYNC_RX,
  ZWIFT_SYNC_TX,
  ZwiftButtonTracker,
  type ZwiftButton,
} from '@cyclotron/core'
import { logEvent, traceBle } from '../lib/diag'
import { BleLink } from './ble-link'
import { Emitter } from './emitter'
import type { LinkStatus } from './types'

/** Name plus the last 4 characters of the address, like the trainer's "KICKR CORE 8E84". */
export function controllerLabel(name: string, address: string | undefined): string {
  const tail = (address ?? '')
    .replace(/[^0-9a-z]/gi, '')
    .slice(-4)
    .toUpperCase()
  return tail ? `${name} ${tail}` : name
}

/** Ask for both Zwift services (Play/Click, and Ride/Click v2/Play fw2) when picking. */
export const CONTROLLER_SERVICES: BluetoothServiceUUID[] = [ZWIFT_SERVICE, ZWIFT_RIDE_SERVICE]

/**
 * A Zwift Play / Click / Ride controller (buttons). Each Play unit (left, right) is its own
 * device on firmware 1.x; Ride, Click v2 and Play firmware 2 relay both through one.
 */
export class ZwiftController {
  readonly name: string
  /** "Zwift Play 0523": a Play is two devices with the same name, the address tells them apart. */
  readonly label: string
  readonly presses = new Emitter<ZwiftButton>()
  private link: BleLink
  private tracker = new ZwiftButtonTracker()

  private constructor(
    device: BluetoothDevice,
    readonly address: string | undefined,
  ) {
    this.name = device.name ?? 'Zwift'
    this.label = controllerLabel(this.name, address)
    this.link = new BleLink(
      device,
      (server) => this.setup(server),
      () => {},
    )
  }

  static async connect(device: BluetoothDevice, address?: string): Promise<ZwiftController> {
    const c = new ZwiftController(device, address)
    await c.link.open()
    return c
  }

  onStatus(listener: (status: LinkStatus) => void): () => void {
    return this.link.status.on(listener)
  }

  async disconnect(): Promise<void> {
    this.link.close()
    this.presses.clear()
  }

  private async setup(server: BluetoothRemoteGATTServer): Promise<void> {
    const service = await server
      .getPrimaryService(ZWIFT_RIDE_SERVICE)
      .catch(() => server.getPrimaryService(ZWIFT_SERVICE))
    const async = await service.getCharacteristic(ZWIFT_ASYNC)
    const rx = await service.getCharacteristic(ZWIFT_SYNC_RX)
    const tx = await service.getCharacteristic(ZWIFT_SYNC_TX).catch(() => undefined)
    async.oncharacteristicvaluechanged = () => {
      const v = async.value
      if (!v) return
      traceBle(this.label, 'zwift', v)
      const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
      for (const b of this.tracker.update(bytes)) this.presses.emit(b)
    }
    await async.startNotifications()
    if (tx) {
      tx.oncharacteristicvaluechanged = () => tx.value && traceBle(this.label, 'zwift-tx', tx.value)
      await tx.startNotifications().catch(() => undefined)
    }
    // Plain "RideOn": current firmware then sends unencrypted button frames.
    await rx.writeValueWithoutResponse(RIDE_ON)
    logEvent('info', `${this.label}: controller connected (${service.uuid})`)
  }
}
