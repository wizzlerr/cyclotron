import type { TrainerControl } from '@cyclotron/core'

export type { TrainerControl }

/** A live BLE link either works or is being re-established (E1-5). */
export type LinkStatus = 'connected' | 'reconnecting'

export interface TrainerData {
  powerW: number
  cadenceRpm: number
  speedKmh: number
}

/**
 * A controllable trainer. Implemented by the simulated trainer (E1-6) and the FTMS trainer
 * (E1-2/E2). Implementations handle protocol details such as FTMS Request Control.
 */
export interface Trainer {
  readonly kind: 'simulated' | 'ftms'
  readonly name: string
  /** Live data, roughly 1 Hz. Returns an unsubscribe function. */
  onData(listener: (data: TrainerData) => void): () => void
  /** Fires once when `disconnect()` is called. Dropped links reconnect on their own. */
  onDisconnect(listener: () => void): () => void
  onStatus(listener: (status: LinkStatus) => void): () => void
  /** Heart rate relayed by the trainer itself (a KICKR bridges a paired strap), if any. */
  readonly heartRate?: HeartRateSource
  /** Applied again after a reconnect. Rejects if the trainer refuses the command. */
  setControl(control: TrainerControl): Promise<void>
  disconnect(): Promise<void>
}

export interface HeartRateSource {
  readonly name: string
  onHeartRate(listener: (bpm: number) => void): () => void
  onStatus(listener: (status: LinkStatus) => void): () => void
  disconnect(): Promise<void>
}
