// E1-0 spike: connect to any BLE device, list its GATT tree, read static values, log every
// notification, and drive the FTMS control point by hand. Throwaway code; the real device layer
// comes in E1-1..E1-5 and E2.

import {
  GATT,
  parseControlPointResponse,
  parseFtmsFeatures,
  parseIndoorBikeData,
  parsePowerRange,
  shortUuid,
  sigUuid,
  toHex,
  uuidName,
  type ControlPointResponse,
  type FtmsFeatures,
  type IndoorBikeData,
  type PowerRange,
} from '@cyclotron/core'

export interface CharacteristicInfo {
  uuid: string
  name?: string
  properties: string[]
}

export interface ServiceInfo {
  uuid: string
  name?: string
  characteristics: CharacteristicInfo[]
}

export interface ReadValue {
  uuid: string
  name?: string
  hex: string
  text?: string
}

export interface LogEntry {
  seq: number
  /** Milliseconds since connect. */
  t: number
  kind: 'notify' | 'write' | 'read' | 'info' | 'error'
  uuid?: string
  hex?: string
  note?: string
}

export type Status = 'idle' | 'requesting' | 'connecting' | 'connected' | 'disconnected'

// Web Bluetooth only exposes services listed here. Wahoo's proprietary services share the
// a026xxxx-0a7d-4ab3-97fa-f1500f9feb8b base; a026ee00..0f covers the ones seen on KICKRs.
const OPTIONAL_SERVICES: BluetoothServiceUUID[] = [
  GATT.fitnessMachine,
  GATT.cyclingPower,
  GATT.heartRate,
  GATT.battery,
  GATT.deviceInformation,
  GATT.cyclingSpeedAndCadence,
  ...Array.from(
    { length: 16 },
    (_, i) => `a026ee${i.toString(16).padStart(2, '0')}-0a7d-4ab3-97fa-f1500f9feb8b`,
  ),
]

// Lean mode: only what a ride needs. Fewer GATT operations on connect, fewer notifications.
const LEAN_SERVICES: BluetoothServiceUUID[] = [GATT.fitnessMachine, GATT.heartRate]
const LEAN_CHARACTERISTICS = new Set<number>([
  GATT.ftmsFeature,
  GATT.supportedPowerRange,
  GATT.indoorBikeData,
  GATT.ftmsControlPoint,
  GATT.ftmsStatus,
  GATT.heartRateMeasurement,
])

const TEXT_CHARACTERISTICS = new Set([0x2a00, 0x2a24, 0x2a25, 0x2a26, 0x2a27, 0x2a28, 0x2a29])
const VISIBLE_LOG = 300

const PROPERTY_NAMES = [
  'broadcast',
  'read',
  'writeWithoutResponse',
  'write',
  'notify',
  'indicate',
  'authenticatedSignedWrites',
  'reliableWrite',
  'writableAuxiliaries',
] as const

export class BleSession {
  status = $state<Status>('idle')
  deviceName = $state('')
  services = $state.raw<ServiceInfo[]>([])
  reads = $state.raw<ReadValue[]>([])
  features = $state.raw<FtmsFeatures | undefined>()
  powerRange = $state.raw<PowerRange | undefined>()
  bike = $state.raw<IndoorBikeData>({})
  cpsPowerW = $state<number | undefined>()
  heartRateBpm = $state<number | undefined>()
  lastResponse = $state.raw<ControlPointResponse | undefined>()
  visibleLog = $state.raw<LogEntry[]>([])
  packetCount = $state(0)
  /** Connect to FTMS + Heart Rate only, and use only the characteristics a ride needs. */
  lean = $state(true)

  private device: BluetoothDevice | undefined
  private log: LogEntry[] = []
  private t0 = 0
  // Not reactive on purpose: filled before `status` flips to connected.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  private chars = new Map<string, BluetoothRemoteGATTCharacteristic>()
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  private sentAt = new Map<number, number>()
  private connectMode: 'lean' | 'full' = 'lean'

  get hasControlPoint(): boolean {
    return this.status === 'connected' && this.chars.has(sigUuid(GATT.ftmsControlPoint))
  }

  async connect(): Promise<void> {
    this.reset()
    this.status = 'requesting'
    try {
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.lean ? LEAN_SERVICES : OPTIONAL_SERVICES,
      })
    } catch (e) {
      this.status = 'idle'
      if (!(e instanceof DOMException && e.name === 'NotFoundError')) this.error('requestDevice', e)
      return
    }

    this.status = 'connecting'
    this.connectMode = this.lean ? 'lean' : 'full'
    this.t0 = performance.now()
    this.deviceName = this.device.name ?? '(unnamed)'
    this.device.addEventListener('gattserverdisconnected', () => {
      this.status = 'disconnected'
      this.push({ kind: 'info', note: 'disconnected' })
    })

    try {
      const server = await this.device.gatt!.connect()
      this.push({ kind: 'info', note: `connected to ${this.deviceName} (${this.device.id})` })
      await this.discover(server)
      this.status = 'connected'
      this.push({ kind: 'info', note: `ready (${this.connectMode} mode)` })
    } catch (e) {
      this.error('connect', e)
      this.device.gatt?.disconnect()
      this.status = 'disconnected'
    }
  }

  disconnect(): void {
    this.device?.gatt?.disconnect()
  }

  /** Writes a raw command to the FTMS control point; the response arrives as an indication. */
  async control(label: string, bytes: Uint8Array): Promise<void> {
    const cp = this.chars.get(sigUuid(GATT.ftmsControlPoint))
    if (!cp) return
    this.push({ kind: 'write', uuid: cp.uuid, hex: toHex(bytes), note: label })
    this.sentAt.set(bytes[0]!, performance.now())
    try {
      await cp.writeValueWithResponse(bytes as Uint8Array<ArrayBuffer>)
    } catch (e) {
      this.error(label, e)
    }
  }

  /** Everything captured so far, for saving as a test fixture. */
  capture(): object {
    return {
      // eslint-disable-next-line svelte/prefer-svelte-reactivity
      capturedAt: new Date().toISOString(),
      device: { name: this.deviceName, id: this.device?.id },
      mode: this.connectMode,
      services: this.services,
      reads: this.reads,
      ftmsFeatures: this.features,
      powerRange: this.powerRange,
      log: this.log,
    }
  }

  private reset(): void {
    this.disconnect()
    this.chars.clear()
    this.sentAt.clear()
    this.log = []
    this.services = []
    this.reads = []
    this.features = undefined
    this.powerRange = undefined
    this.bike = {}
    this.cpsPowerW = undefined
    this.heartRateBpm = undefined
    this.lastResponse = undefined
    this.visibleLog = []
    this.packetCount = 0
  }

  private async discover(server: BluetoothRemoteGATTServer): Promise<void> {
    const services: ServiceInfo[] = []
    for (const service of await server.getPrimaryServices()) {
      const characteristics: CharacteristicInfo[] = []
      let chars: BluetoothRemoteGATTCharacteristic[] = []
      try {
        chars = await service.getCharacteristics()
      } catch (e) {
        this.error(`getCharacteristics ${service.uuid}`, e)
      }
      for (const c of chars) {
        const short = shortUuid(c.uuid)
        if (!this.lean || (short !== undefined && LEAN_CHARACTERISTICS.has(short))) {
          this.chars.set(c.uuid, c)
        }
        characteristics.push({
          uuid: c.uuid,
          name: uuidName(c.uuid),
          properties: PROPERTY_NAMES.filter((p) => c.properties[p]),
        })
      }
      services.push({ uuid: service.uuid, name: uuidName(service.uuid), characteristics })
    }
    this.services = services
    this.push({
      kind: 'info',
      note: `${services.length} services, ${this.chars.size} characteristics`,
    })

    for (const c of this.chars.values()) {
      if (c.properties.read) await this.read(c)
    }
    // Subscribe to the control point first so no response is missed.
    const ordered = [...this.chars.values()].sort(
      (a, b) =>
        Number(shortUuid(b.uuid) === GATT.ftmsControlPoint) -
        Number(shortUuid(a.uuid) === GATT.ftmsControlPoint),
    )
    for (const c of ordered) {
      if (c.properties.notify || c.properties.indicate) await this.subscribe(c)
    }
  }

  private async read(c: BluetoothRemoteGATTCharacteristic): Promise<void> {
    try {
      const dv = await c.readValue()
      const short = shortUuid(c.uuid)
      const value: ReadValue = { uuid: c.uuid, name: uuidName(c.uuid), hex: toHex(dv) }
      if (short !== undefined && TEXT_CHARACTERISTICS.has(short)) {
        value.text = new TextDecoder().decode(dv)
      }
      if (short === GATT.batteryLevel) value.text = `${dv.getUint8(0)} %`
      if (short === GATT.ftmsFeature) this.features = parseFtmsFeatures(dv)
      if (short === GATT.supportedPowerRange) {
        this.powerRange = parsePowerRange(dv)
        value.text = `${this.powerRange.minW}–${this.powerRange.maxW} W, step ${this.powerRange.incrementW}`
      }
      this.reads = [...this.reads, value]
      this.push({ kind: 'read', uuid: c.uuid, hex: value.hex, note: value.text })
    } catch (e) {
      this.error(`read ${uuidName(c.uuid) ?? c.uuid}`, e)
    }
  }

  private async subscribe(c: BluetoothRemoteGATTCharacteristic): Promise<void> {
    try {
      c.addEventListener('characteristicvaluechanged', () => {
        if (c.value) this.onValue(c.uuid, c.value)
      })
      await c.startNotifications()
      this.push({ kind: 'info', uuid: c.uuid, note: `subscribed ${uuidName(c.uuid) ?? ''}` })
    } catch (e) {
      this.error(`subscribe ${uuidName(c.uuid) ?? c.uuid}`, e)
    }
  }

  private onValue(uuid: string, dv: DataView): void {
    let note: string | undefined
    try {
      switch (shortUuid(uuid)) {
        case GATT.indoorBikeData:
          this.bike = { ...this.bike, ...parseIndoorBikeData(dv) }
          break
        case GATT.ftmsControlPoint: {
          const r = parseControlPointResponse(dv)
          if (r) {
            this.lastResponse = r
            const sent = this.sentAt.get(r.requestOp)
            const latency =
              sent === undefined ? '' : ` (+${Math.round(performance.now() - sent)} ms)`
            note = `response to 0x${r.requestOp.toString(16).padStart(2, '0')}: ${r.result}${latency}`
          }
          break
        }
        case GATT.cyclingPowerMeasurement:
          this.cpsPowerW = dv.getInt16(2, true)
          break
        case GATT.heartRateMeasurement:
          this.heartRateBpm = dv.getUint8(0) & 1 ? dv.getUint16(1, true) : dv.getUint8(1)
          break
      }
    } catch (e) {
      note = `parse error: ${String(e)}`
    }
    this.packetCount++
    this.push({ kind: 'notify', uuid, hex: toHex(dv), note })
  }

  private error(context: string, e: unknown): void {
    this.push({ kind: 'error', note: `${context}: ${e instanceof Error ? e.message : String(e)}` })
  }

  private push(entry: Omit<LogEntry, 't' | 'seq'>): void {
    const full = { seq: this.log.length, t: Math.round(performance.now() - this.t0), ...entry }
    this.log.push(full)
    this.visibleLog = [full, ...this.visibleLog.slice(0, VISIBLE_LOG - 1)]
  }
}
