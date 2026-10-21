// Ride recording math (E5, DESIGN.md §4.3, §5). Each sample covers one second.

import { normalizedPower, trainingStress } from '../metrics/power'

export interface RideSample {
  /** Seconds since the ride started (wall clock, pauses included). Sample covers (t-1, t]. */
  t: number
  powerW?: number
  cadenceRpm?: number
  speedKmh?: number
  heartRateBpm?: number
  targetW?: number
  /** Workout segment index, used for laps. */
  segment?: number
  paused?: boolean
}

export interface IntervalSummary {
  /** `t` of the first and last sample. */
  firstT: number
  lastT: number
  /** Seconds covered, pauses included. */
  elapsedS: number
  /** Seconds not paused. */
  timerS: number
  avgPowerW: number
  maxPowerW: number
  normalizedPowerW: number
  avgCadenceRpm?: number
  maxCadenceRpm?: number
  avgHeartRateBpm?: number
  maxHeartRateBpm?: number
  avgSpeedKmh: number
  maxSpeedKmh: number
  distanceM: number
  workKj: number
}

export interface RideSummary extends IntervalSummary {
  ftpW: number
  intensity: number
  tss: number
}

export interface Lap {
  segment: number | undefined
  summary: IntervalSummary
}

/** Summarises samples. Averages use non-paused samples; cadence average ignores coasting zeros. */
export function summarizeInterval(samples: readonly RideSample[]): IntervalSummary {
  const active = samples.filter((s) => !s.paused)
  const power = active.map((s) => s.powerW ?? 0)
  const cadence = active.map((s) => s.cadenceRpm ?? 0).filter((c) => c > 0)
  const hr = active.map((s) => s.heartRateBpm).filter((h): h is number => h !== undefined && h > 0)
  const speed = active.map((s) => s.speedKmh ?? 0)
  const work = sum(power)
  const distanceM = sum(speed) / 3.6
  const first = samples[0]
  const last = samples.at(-1)
  return {
    firstT: first?.t ?? 0,
    lastT: last?.t ?? 0,
    elapsedS: first && last ? last.t - first.t + 1 : 0,
    timerS: active.length,
    avgPowerW: mean(power) ?? 0,
    maxPowerW: max(power) ?? 0,
    normalizedPowerW: normalizedPower(power),
    avgCadenceRpm: mean(cadence),
    maxCadenceRpm: max(cadence),
    avgHeartRateBpm: mean(hr),
    maxHeartRateBpm: max(hr),
    avgSpeedKmh: active.length > 0 ? (distanceM / active.length) * 3.6 : 0,
    maxSpeedKmh: max(speed) ?? 0,
    distanceM,
    workKj: work / 1000,
  }
}

export function summarizeRide(samples: readonly RideSample[], ftpW: number): RideSummary {
  const s = summarizeInterval(samples)
  // NP needs 30 s of data; for very short rides fall back to average power.
  const np = s.normalizedPowerW || s.avgPowerW
  return {
    ...s,
    normalizedPowerW: np,
    ftpW,
    intensity: ftpW > 0 ? np / ftpW : 0,
    tss: trainingStress(s.timerS, np, ftpW),
  }
}

/** One lap per run of samples with the same workout segment (one lap for a free ride). */
export function rideLaps(samples: readonly RideSample[]): Lap[] {
  const laps: Lap[] = []
  let start = 0
  for (let i = 1; i <= samples.length; i++) {
    if (i === samples.length || samples[i]!.segment !== samples[start]!.segment) {
      const part = samples.slice(start, i)
      laps.push({ segment: part[0]!.segment, summary: summarizeInterval(part) })
      start = i
    }
  }
  return laps
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)
const mean = (xs: readonly number[]): number | undefined =>
  xs.length > 0 ? sum(xs) / xs.length : undefined
const max = (xs: readonly number[]): number | undefined =>
  xs.length > 0 ? xs.reduce((a, b) => Math.max(a, b)) : undefined
