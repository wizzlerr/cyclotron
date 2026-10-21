import { Emitter } from './emitter'
import type { LinkStatus } from './types'

// Windows took ~21 s to connect to the KICKR in E1-0, so be generous.
const CONNECT_TIMEOUT_MS = 45_000
const RETRY_MIN_MS = 1_000
const RETRY_MAX_MS = 10_000

/**
 * One GATT connection that re-establishes itself when it drops (E1-5). `setup` runs after every
 * (re)connect and must find characteristics and start notifications again; `onLost` runs when the
 * link drops so the owner can fail in-flight work.
 */
export class BleLink {
  readonly status = new Emitter<LinkStatus>()
  private closed = false
  private reconnecting = false

  constructor(
    readonly device: BluetoothDevice,
    private setup: (server: BluetoothRemoteGATTServer) => Promise<void>,
    private onLost: () => void,
  ) {}

  /** First connect. Rejects (and leaves the device disconnected) if it fails. */
  async open(): Promise<void> {
    try {
      await this.connectOnce()
    } catch (e) {
      this.device.gatt?.disconnect()
      throw e
    }
    this.device.addEventListener('gattserverdisconnected', this.handleDisconnect)
  }

  close(): void {
    this.closed = true
    this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect)
    this.device.gatt?.disconnect()
    this.status.clear()
  }

  private async connectOnce(): Promise<void> {
    const gatt = this.device.gatt
    if (!gatt) throw new Error('device has no GATT server')
    const server = await withTimeout(gatt.connect(), CONNECT_TIMEOUT_MS, 'connect')
    await this.setup(server)
  }

  private handleDisconnect = (): void => {
    if (this.closed || this.reconnecting) return
    this.onLost()
    this.status.emit('reconnecting')
    void this.reconnect()
  }

  private async reconnect(): Promise<void> {
    this.reconnecting = true
    let delay = RETRY_MIN_MS
    while (!this.closed) {
      try {
        await this.connectOnce()
        if (this.closed) break
        this.reconnecting = false
        this.status.emit('connected')
        return
      } catch {
        this.onLost()
        this.device.gatt?.disconnect()
        await new Promise((r) => setTimeout(r, delay))
        delay = Math.min(delay * 2, RETRY_MAX_MS)
      }
    }
    this.reconnecting = false
    this.device.gatt?.disconnect()
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000} s`)), ms)
  })
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer))
}
