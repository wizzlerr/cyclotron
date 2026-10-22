import {
  controlCommand,
  encodeRequestControl,
  encodeStartOrResume,
  FtmsCommandQueue,
  GATT,
  parseControlPointResponse,
  parseFtmsFeatures,
  parseHeartRateMeasurement,
  parseIndoorBikeData,
  type ControlPointResponse,
  type FtmsFeatures,
} from '@cyclotron/core'
import { BleLink } from './ble-link'
import { Emitter } from './emitter'
import type { HeartRateSource, LinkStatus, Trainer, TrainerControl, TrainerData } from './types'
import { t } from '../i18n/t'

/** Services the trainer connection asks for. Kept lean: E1-0 saw ~70 s connects with everything. */
export const TRAINER_SERVICES: BluetoothServiceUUID[] = [GATT.fitnessMachine, GATT.heartRate]

// E1-0 saw a ~10 s Control Point response from across the house.
const RESPONSE_TIMEOUT_MS = 15_000

interface PendingResponse {
  op: number
  resolve: (r: ControlPointResponse) => void
  reject: (e: unknown) => void
}

/** A trainer controlled over the Fitness Machine Service (E1-2, E2-1, E2-2, E2-5). */
export class FtmsTrainer implements Trainer {
  readonly kind = 'ftms'
  readonly name: string
  heartRate: HeartRateSource | undefined
  features: FtmsFeatures | undefined

  private link: BleLink
  private queue = new FtmsCommandQueue((bytes) => this.send(bytes))
  private controlPoint: BluetoothRemoteGATTCharacteristic | undefined
  private pending: PendingResponse | undefined
  private control: TrainerControl | undefined
  private latest: TrainerData = { powerW: 0, cadenceRpm: 0, speedKmh: 0 }
  private data = new Emitter<TrainerData>()
  private hr = new Emitter<number>()
  private disconnected = new Emitter<void>()

  private constructor(device: BluetoothDevice) {
    this.name = device.name ?? t().app.devices.trainer
    this.link = new BleLink(
      device,
      (server) => this.setup(server),
      () => this.lost(),
    )
  }

  /** Connects, subscribes, and takes control in the background. */
  static async connect(device: BluetoothDevice): Promise<FtmsTrainer> {
    const trainer = new FtmsTrainer(device)
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

  async setControl(control: TrainerControl): Promise<void> {
    this.control = control
    // Not connected: applied by setup() after the reconnect.
    if (this.controlPoint) await this.apply(control)
  }

  async disconnect(): Promise<void> {
    this.link.close()
    this.lost()
    this.disconnected.emit()
    this.data.clear()
    this.hr.clear()
    this.disconnected.clear()
  }

  private async setup(server: BluetoothRemoteGATTServer): Promise<void> {
    // Sequential on purpose: parallel GATT operations are slow or flaky on Windows.
    const ftms = await server.getPrimaryService(GATT.fitnessMachine)
    if (!this.features) {
      const feature = await ftms.getCharacteristic(GATT.ftmsFeature)
      this.features = parseFtmsFeatures(await feature.readValue())
    }

    // Subscribe to the Control Point before writing so no response is missed.
    const cp = await ftms.getCharacteristic(GATT.ftmsControlPoint)
    cp.oncharacteristicvaluechanged = () => cp.value && this.onResponse(cp.value)
    await cp.startNotifications()

    const bike = await ftms.getCharacteristic(GATT.indoorBikeData)
    bike.oncharacteristicvaluechanged = () => bike.value && this.onBikeData(bike.value)
    await bike.startNotifications()

    await this.setupHeartRate(server)

    this.controlPoint = cp
    void this.takeControl()
  }

  /** The KICKR exposes a Heart Rate service that relays a strap paired to it. Optional. */
  private async setupHeartRate(server: BluetoothRemoteGATTServer): Promise<void> {
    let hrm: BluetoothRemoteGATTCharacteristic
    try {
      const service = await server.getPrimaryService(GATT.heartRate)
      hrm = await service.getCharacteristic(GATT.heartRateMeasurement)
    } catch {
      return
    }
    hrm.oncharacteristicvaluechanged = () => {
      if (hrm.value) this.hr.emit(parseHeartRateMeasurement(hrm.value).bpm)
    }
    await hrm.startNotifications()
    this.heartRate ??= {
      name: `${this.name} (relayed)`,
      onHeartRate: (listener) => this.hr.on(listener),
      onStatus: (listener) => this.link.status.on(listener),
      disconnect: async () => {},
    }
  }

  private async takeControl(): Promise<void> {
    try {
      await this.expectOk(encodeRequestControl(), 'request control')
      await this.expectOk(encodeStartOrResume(), 'start')
      if (this.control) await this.apply(this.control)
    } catch (e) {
      console.warn(`${this.name}: taking control failed`, e)
    }
  }

  private async apply(control: TrainerControl): Promise<void> {
    const command = controlCommand(control)
    await this.expectOk(command.bytes, command.label, command.slot)
  }

  private async expectOk(bytes: Uint8Array, label: string, slot?: string): Promise<void> {
    const r = await this.queue.enqueue({ label, bytes, slot })
    if (!r.ok) throw new Error(`${label}: ${r.result}`)
  }

  /** Writes one command and waits for its response indication. The queue serialises calls. */
  private send(bytes: Uint8Array): Promise<ControlPointResponse> {
    const cp = this.controlPoint
    if (!cp) return Promise.reject(new Error('not connected'))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = undefined
        reject(new Error(`no response to 0x${bytes[0]!.toString(16)}`))
      }, RESPONSE_TIMEOUT_MS)
      const done = (): void => {
        clearTimeout(timer)
        this.pending = undefined
      }
      this.pending = {
        op: bytes[0]!,
        resolve: (r) => (done(), resolve(r)),
        reject: (e) => (done(), reject(e)),
      }
      cp.writeValueWithResponse(bytes as Uint8Array<ArrayBuffer>).catch((e: unknown) =>
        this.pending?.reject(e),
      )
    })
  }

  private onResponse(dv: DataView): void {
    const r = parseControlPointResponse(dv)
    if (r && r.requestOp === this.pending?.op) this.pending.resolve(r)
  }

  private onBikeData(dv: DataView): void {
    const d = parseIndoorBikeData(dv)
    this.latest = {
      powerW: d.powerW ?? this.latest.powerW,
      cadenceRpm: d.cadenceRpm ?? this.latest.cadenceRpm,
      speedKmh: d.speedKmh ?? this.latest.speedKmh,
    }
    this.data.emit(this.latest)
  }

  /** The link dropped (or we closed it): fail everything in flight. */
  private lost(): void {
    this.controlPoint = undefined
    const error = new Error('trainer disconnected')
    this.pending?.reject(error)
    this.queue.clear(error)
  }
}
