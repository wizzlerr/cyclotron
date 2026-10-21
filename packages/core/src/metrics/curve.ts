// Per-ride aggregates computed once at upload (E8-5, DESIGN.md §5, §8.3).

import { bestAverage } from './power'
import { POWER_ZONES } from './zones'

/** Durations of the power curve, seconds (DESIGN.md §5). */
export const POWER_CURVE_DURATIONS = [
  1, 5, 10, 15, 30, 60, 120, 180, 300, 480, 600, 720, 1200, 1800, 2700, 3600,
] as const

export interface PowerCurvePoint {
  durationS: number
  watts: number
}

/** Best average power for each standard duration the ride is long enough for. */
export function powerCurve(power: readonly number[]): PowerCurvePoint[] {
  const out: PowerCurvePoint[] = []
  for (const d of POWER_CURVE_DURATIONS) {
    const w = bestAverage(power, d)
    if (w === undefined) break
    out.push({ durationS: d, watts: Math.round(w * 10) / 10 })
  }
  return out
}

/** Seconds spent in each Coggan power zone (index 0 = Z1 … 6 = Z7), one sample per second. */
export function zoneTimes(power: readonly number[], ftpW: number): number[] {
  const times = POWER_ZONES.map(() => 0)
  if (ftpW <= 0) return times
  for (const w of power) {
    const pct = w / ftpW
    const i = POWER_ZONES.findIndex((z) => pct <= z.maxPct)
    times[i]!++
  }
  return times
}
