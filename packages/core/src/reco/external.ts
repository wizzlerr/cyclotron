import { addDays } from '../metrics/load'
import type { ReadinessSignal } from './types'

// Data from outside the app (E12-5/E12-6): other activities (runs, outdoor rides) for the load,
// and daily wellness values for readiness. Garmin is the first source; nothing here is Garmin
// specific beyond the field meanings.

export interface ExternalActivity {
  durationS: number
  avgHr?: number
  /** TSS from the source (e.g. a ride with a power meter). */
  tss?: number
  intensity?: number
}

/** Highest IF we believe from heart rate (HR drifts up; short sprints overshoot). */
const MAX_HR_IF = 1.1

/**
 * Load of an activity on the TSS scale: the source's TSS when it has one (power), otherwise
 * heart-rate TSS: hours × (avg HR / lactate threshold HR)² × 100.
 */
export function externalLoad(
  a: ExternalActivity,
  thresholdHr: number | undefined,
): { tss: number; intensity: number } | undefined {
  if (a.tss !== undefined && a.tss > 0) {
    const intensity = a.intensity ?? Math.sqrt(a.tss / ((a.durationS / 3600) * 100))
    return { tss: a.tss, intensity }
  }
  if (!a.avgHr || !thresholdHr || a.durationS <= 0) return undefined
  const intensity = Math.min(MAX_HR_IF, a.avgHr / thresholdHr)
  return { tss: (a.durationS / 3600) * intensity ** 2 * 100, intensity }
}

/** One day of wellness values; missing values are undefined. */
export interface DailyWellness {
  /** YYYY-MM-DD. */
  date: string
  restingHr?: number
  /** Highest Body Battery of the day (≈ the morning charge). */
  bodyBatteryMax?: number
  /** Hours the device covered that day (stress/wellness monitoring). */
  coverageH?: number
  sleepS?: number
}

/** A day counts only when the device was worn most of it (not just during activities). */
const MIN_COVERAGE_H = 18
/** A real resting HR; values above this come from a device worn only while active. */
const MAX_RESTING_HR = 90
const RESTING_HR_DAYS = 14
const RESTING_HR_MIN_DAYS = 4
/** Resting HR this far above the usual means less recovered. */
const RESTING_HR_UP = 5
const BATTERY_LOW = 30
const BATTERY_HIGH = 80
const SLEEP_SHORT_S = 5.5 * 3600

/**
 * Readiness signals from wellness data (E12-6, through the E11-11 interface). Each rule only
 * fires when its data looks complete, so a watch worn only during workouts adds nothing.
 */
export function wellnessSignals(days: readonly DailyWellness[], today: string): ReadinessSignal[] {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const d = byDate.get(today)
  const out: ReadinessSignal[] = []
  if (!d) return out
  const worn = (x: DailyWellness | undefined): boolean => (x?.coverageH ?? 0) >= MIN_COVERAGE_H
  const plausibleHr = (x: DailyWellness | undefined): x is DailyWellness & { restingHr: number } =>
    x?.restingHr !== undefined && x.restingHr >= 30 && x.restingHr <= MAX_RESTING_HR

  if (plausibleHr(d)) {
    const past: number[] = []
    for (let i = 1; i <= RESTING_HR_DAYS; i++) {
      const x = byDate.get(addDays(today, -i))
      if (plausibleHr(x)) past.push(x.restingHr)
    }
    if (past.length >= RESTING_HR_MIN_DAYS) {
      const usual = past.reduce((a, b) => a + b, 0) / past.length
      if (d.restingHr >= usual + RESTING_HR_UP) {
        out.push({ source: 'restingHr', kind: 'hrv', shift: -1 })
      }
    }
  }
  // Body Battery means little unless the watch was worn overnight (it charges while asleep).
  const yesterday = byDate.get(addDays(today, -1))
  if (d.bodyBatteryMax !== undefined && worn(yesterday)) {
    if (d.bodyBatteryMax < BATTERY_LOW)
      out.push({ source: 'bodyBattery', kind: 'readiness', shift: -1 })
    else if (d.bodyBatteryMax >= BATTERY_HIGH) {
      out.push({ source: 'bodyBattery', kind: 'readiness', shift: 1 })
    }
  }
  if (d.sleepS !== undefined && d.sleepS > 0 && d.sleepS < SLEEP_SHORT_S) {
    out.push({ source: 'sleep', kind: 'sleep', shift: -1 })
  }
  return out
}
