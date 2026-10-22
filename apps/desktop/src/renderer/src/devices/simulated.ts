import {
  DEFAULT_SIM_CONFIG,
  initialSimState,
  seededRng,
  stepSim,
  type SimConfig,
  type SimState,
  type TrainerControl,
} from '@cyclotron/core'
import { Emitter } from './emitter'
import type { HeartRateSource, Trainer, TrainerData, TrainerCapabilities } from './types'
import { t } from '../i18n/t'

const TICK_MS = 1000

/** Fake trainer + HR strap driven by the core simulation model (E1-6). */
export class SimulatedTrainer implements Trainer {
  readonly kind = 'simulated'
  get name(): string {
    return t().app.devices.simulatedTrainer
  }
  readonly heartRate: HeartRateSource

  private state: SimState
  private control: TrainerControl = { kind: 'free' }
  private rng = seededRng(Date.now())
  private last = performance.now()
  private timer: ReturnType<typeof setInterval> | undefined
  private data = new Emitter<TrainerData>()
  private hr = new Emitter<number>()
  private disconnected = new Emitter<void>()

  constructor(private cfg: SimConfig = DEFAULT_SIM_CONFIG) {
    this.state = initialSimState(cfg)
    this.timer = setInterval(() => this.tick(), TICK_MS)
    this.heartRate = {
      get name() {
        return t().app.devices.simulatedHr
      },
      onHeartRate: (listener) => this.hr.on(listener),
      onStatus: () => () => {},
      disconnect: async () => {},
    }
  }

  onData(listener: (data: TrainerData) => void): () => void {
    return this.data.on(listener)
  }

  onDisconnect(listener: () => void): () => void {
    return this.disconnected.on(listener)
  }

  onStatus(): () => void {
    return () => {}
  }

  async setControl(control: TrainerControl): Promise<void> {
    this.control = control
  }

  capabilities(): TrainerCapabilities {
    return { erg: true, resistance: true, simulation: true, calibration: false }
  }

  async disconnect(): Promise<void> {
    if (this.timer === undefined) return
    clearInterval(this.timer)
    this.timer = undefined
    this.disconnected.emit()
    this.data.clear()
    this.hr.clear()
    this.disconnected.clear()
  }

  private tick(): void {
    const now = performance.now()
    const { state, sample } = stepSim(
      this.state,
      this.control,
      (now - this.last) / 1000,
      this.rng,
      this.cfg,
    )
    this.last = now
    this.state = state
    this.data.emit({
      powerW: sample.powerW,
      cadenceRpm: sample.cadenceRpm,
      speedKmh: sample.speedKmh,
    })
    this.hr.emit(sample.heartRateBpm)
  }
}
