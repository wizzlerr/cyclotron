import {
  OBC_APP_INFO,
  OBC_BUTTON_STATE,
  OBC_SERVICE,
  OBC_SUPPORTED_IDS,
  ObcButtonTracker,
  obcAppInfo,
  type ObcContext,
  type ZwiftButton,
} from '@cyclotron/core'
import { logEvent, traceBle } from '../lib/diag'
import { BleLink } from './ble-link'
import { Emitter } from './emitter'
import type { LinkStatus } from './types'
import { controllerLabel } from './zwift-controller'

/**
 * An OpenBikeControl controller (buttons). Its buttons come out as the matching Zwift buttons,
 * so it drives navigation and the ride actions like a Zwift Play. `context` says where a press
 * lands, to pick one action when a button sends several ids.
 */
export class ObcController {
  readonly name: string
  readonly label: string
  readonly presses = new Emitter<ZwiftButton>()
  private link: BleLink
  private tracker = new ObcButtonTracker()

  private constructor(
    device: BluetoothDevice,
    readonly address: string | undefined,
    private context: () => ObcContext,
  ) {
    this.name = device.name ?? 'OpenBikeControl'
    this.label = controllerLabel(this.name, address)
    this.link = new BleLink(
      device,
      (server) => this.setup(server),
      () => {},
    )
  }

  static async connect(
    device: BluetoothDevice,
    address: string | undefined,
    context: () => ObcContext,
  ): Promise<ObcController> {
    const c = new ObcController(device, address, context)
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
    const service = await server.getPrimaryService(OBC_SERVICE)
    const state = await service.getCharacteristic(OBC_BUTTON_STATE)
    // A fresh link starts with nothing held.
    this.tracker = new ObcButtonTracker()
    state.oncharacteristicvaluechanged = () => {
      const v = state.value
      if (!v) return
      traceBle(this.label, 'obc', v)
      const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
      const b = this.tracker.update(bytes, this.context())
      if (b) this.presses.emit(b)
    }
    await state.startNotifications()
    // Optional: tells the device which buttons we use, so it can adapt.
    const info = await service.getCharacteristic(OBC_APP_INFO).catch(() => undefined)
    if (info) {
      const version = await window.cyclotron.app.getVersion().catch(() => '')
      await info
        .writeValueWithResponse(obcAppInfo('cyclotron', version, OBC_SUPPORTED_IDS))
        .catch(() => undefined)
    }
    logEvent('info', `${this.label}: OpenBikeControl controller connected`)
  }
}
