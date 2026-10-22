import { addDays, type DailyLoad } from '../metrics/load'
import {
  READINESS,
  type Readiness,
  type ReadinessSignal,
  type Reason,
  type RideRecord,
} from './types'

// Readiness (E11-2, DESIGN.md §7.2 step 1): TSB bands, then adjustments for recent hard or failed
// rides and optional outside signals (E11-11).

/** Rides at or above this IF count as hard. */
export const HARD_IF = 0.85
/** Below this share of work seconds at target, a ride counts as failed (E11-8). */
const FAILED_TARGET_HIT = 0.8
/** Ended before this share of the planned time: failed. */
const FAILED_COMPLETED = 0.8

/** Shorter rides are false starts: they don't count as failed workouts or move levels. */
export const MIN_COUNTED_S = 300

export function isHard(r: RideRecord): boolean {
  return r.intensity >= HARD_IF
}

/** Rider said so, or the targets weren't held, or the workout was cut short (E11-8). */
export function rideFailed(r: RideRecord): boolean {
  if (r.durationS < MIN_COUNTED_S) return false
  return (
    r.feedback === 'failed' ||
    (r.targetHit !== undefined && r.targetHit < FAILED_TARGET_HIT) ||
    (r.completed !== undefined && r.completed < FAILED_COMPLETED)
  )
}

export interface ReadinessResult {
  readiness: Readiness
  tsb: number
  reasons: Reason[]
}

export function readinessFor(
  today: string,
  load: readonly DailyLoad[],
  rides: readonly RideRecord[],
  signals: readonly ReadinessSignal[] = [],
): ReadinessResult {
  const tsb = load.find((d) => d.date === today)?.tsb ?? load.at(-1)?.tsb ?? 0
  let level = tsb > 5 ? 0 : tsb >= -10 ? 1 : tsb >= -25 ? 2 : 3
  const reasons: Reason[] = []

  const yesterday = addDays(today, -1)
  const hardOn = (date: string): boolean => rides.some((r) => r.date === date && isHard(r))
  if (hardOn(yesterday) && hardOn(addDays(today, -2))) {
    level = Math.max(level, 2)
    reasons.push({ code: 'twoHardDays' })
  } else if (hardOn(yesterday)) {
    level = Math.max(level, 1)
    reasons.push({ code: 'hardYesterday' })
  }
  if (rides.some((r) => r.date >= addDays(today, -2) && r.date < today && rideFailed(r))) {
    level++
    reasons.push({ code: 'recentFail' })
  }
  for (const s of signals) {
    if (s.shift === 0) continue
    level -= s.shift
    reasons.push({ code: 'signal', source: s.source, shift: s.shift })
  }

  const readiness = READINESS[Math.min(3, Math.max(0, level))]!
  reasons.unshift({ code: 'readiness', readiness, tsb })
  return { readiness, tsb, reasons }
}
