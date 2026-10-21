// Live ride metrics (E4-3): O(1) per 1 Hz sample, and equal to `summarizeRide` over the same
// samples, so the numbers on screen match the saved ride.

import type { RideSample } from '../ride/summary'
import { trainingStress } from './power'

const NP_WINDOW = 30

export interface LiveMetrics {
  /** Seconds not paused. */
  timerS: number
  avgPowerW: number
  maxPowerW: number
  /** Falls back to average power before 30 s of data, like `summarizeRide`. */
  normalizedPowerW: number
  intensity: number
  tss: number
  workKj: number
  avgHeartRateBpm?: number
  maxHeartRateBpm?: number
  avgCadenceRpm?: number
  /** Average power per kg of rider weight; undefined without a weight. */
  avgWattsPerKg?: number
}

export class LiveRideMetrics {
  private n = 0
  private powerSum = 0
  private powerMax = 0
  private window: number[] = []
  private windowSum = 0
  private np4Sum = 0
  private np4Count = 0
  private hrSum = 0
  private hrCount = 0
  private hrMax = 0
  private cadSum = 0
  private cadCount = 0

  constructor(
    readonly ftpW: number,
    readonly weightKg?: number,
  ) {}

  add(s: RideSample): void {
    if (s.paused) return
    const p = s.powerW ?? 0
    this.n++
    this.powerSum += p
    this.powerMax = Math.max(this.powerMax, p)

    this.window.push(p)
    this.windowSum += p
    if (this.window.length > NP_WINDOW) this.windowSum -= this.window.shift()!
    if (this.window.length === NP_WINDOW) {
      this.np4Sum += (this.windowSum / NP_WINDOW) ** 4
      this.np4Count++
    }

    if (s.heartRateBpm !== undefined && s.heartRateBpm > 0) {
      this.hrSum += s.heartRateBpm
      this.hrCount++
      this.hrMax = Math.max(this.hrMax, s.heartRateBpm)
    }
    if (s.cadenceRpm !== undefined && s.cadenceRpm > 0) {
      this.cadSum += s.cadenceRpm
      this.cadCount++
    }
  }

  snapshot(): LiveMetrics {
    const avg = this.n > 0 ? this.powerSum / this.n : 0
    const np = this.np4Count > 0 ? (this.np4Sum / this.np4Count) ** 0.25 : avg
    return {
      timerS: this.n,
      avgPowerW: avg,
      maxPowerW: this.powerMax,
      normalizedPowerW: np,
      intensity: this.ftpW > 0 ? np / this.ftpW : 0,
      tss: trainingStress(this.n, np, this.ftpW),
      workKj: this.powerSum / 1000,
      avgHeartRateBpm: this.hrCount > 0 ? this.hrSum / this.hrCount : undefined,
      maxHeartRateBpm: this.hrCount > 0 ? this.hrMax : undefined,
      avgCadenceRpm: this.cadCount > 0 ? this.cadSum / this.cadCount : undefined,
      avgWattsPerKg: this.weightKg ? avg / this.weightKg : undefined,
    }
  }
}

/** Average of the values seen in the last `windowMs` (e.g. 3 s power). Time is passed in. */
export class TimeWindowAverage {
  private values: { t: number; v: number }[] = []

  constructor(readonly windowMs: number) {}

  add(tMs: number, value: number): void {
    this.values.push({ t: tMs, v: value })
    this.trim(tMs)
  }

  /** Undefined when nothing arrived within the window. */
  average(nowMs: number): number | undefined {
    this.trim(nowMs)
    if (this.values.length === 0) return undefined
    return this.values.reduce((a, x) => a + x.v, 0) / this.values.length
  }

  clear(): void {
    this.values = []
  }

  private trim(nowMs: number): void {
    while (this.values.length > 0 && this.values[0]!.t <= nowMs - this.windowMs) this.values.shift()
  }
}
