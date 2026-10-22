import { addDays } from '../metrics/load'
import { WORKOUT_TYPES, type WorkoutType } from '../workout/meta'
import { MIN_COUNTED_S, rideFailed } from './readiness'
import type { RideRecord } from './types'

// Progression levels (E11-3, E11-7, DESIGN.md §7.3): one level 1–10 per workout type, replayed from
// the ride history every time, so there is nothing to store or migrate when the rules change.

/**
 * Where a new rider starts: endurance difficulty mostly grows with duration, so it starts higher.
 * Fitness (CTL) above 30 lifts every start by up to 3 levels (CTL 75), so a fit rider who is new
 * to the app isn't offered beginner workouts.
 */
const START: Record<WorkoutType, number> = {
  recovery: 5,
  endurance: 5,
  tempo: 4,
  sweetspot: 3.5,
  threshold: 3,
  vo2max: 3,
  anaerobic: 3,
}

export function startLevel(type: WorkoutType, ctl = 0): number {
  return START[type] + Math.min(3, Math.max(0, (ctl - 30) / 15))
}
/** A completed workout moves the level this far toward its difficulty (plus the feedback bonus). */
const STEP = 0.6
/** Feedback bonus on the workout's difficulty: easy means the rider can go higher. */
const BONUS = { easy: 0.5, right: 0.2, hard: -0.2, none: 0.1 } as const
/** Levels slowly fall when a type isn't trained: after a grace period, per day. */
const DECAY_AFTER_DAYS = 14
const DECAY_PER_DAY = 0.02

export type Levels = Record<WorkoutType, number>

/** `ctl`: current fitness, for the starting levels. */
export function progressionLevels(rides: readonly RideRecord[], today: string, ctl = 0): Levels {
  const levels = Object.fromEntries(WORKOUT_TYPES.map((t) => [t, startLevel(t, ctl)])) as Levels
  const last: Partial<Record<WorkoutType, string>> = {}
  const decay = (type: WorkoutType, to: string): void => {
    const from = last[type]
    if (!from) return
    const idle = daysBetween(from, to) - DECAY_AFTER_DAYS
    if (idle > 0) levels[type] = Math.max(1, levels[type] - idle * DECAY_PER_DAY)
  }

  const sorted = [...rides].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  for (const r of sorted) {
    if (!r.type || r.difficulty === undefined || r.durationS < MIN_COUNTED_S) continue
    decay(r.type, r.date)
    const level = levels[r.type]
    if (rideFailed(r)) {
      levels[r.type] = Math.max(1, level - (r.difficulty <= level ? 0.5 : 0.3))
    } else {
      const bonus = r.feedback && r.feedback !== 'failed' ? BONUS[r.feedback] : BONUS.none
      const target = r.difficulty + bonus
      if (target > level) levels[r.type] = Math.min(10, level + (target - level) * STEP)
    }
    // Decay counts from the last time the type was trained; a ride on a later day resets it.
    last[r.type] = r.date
  }
  for (const t of WORKOUT_TYPES) {
    decay(t, today)
    levels[t] = Math.round(levels[t] * 10) / 10
  }
  return levels
}

/** Whole days from `a` to `b` (YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** Dates `days` back from `today`, inclusive of today: `[from, today]`. */
export function windowStart(today: string, days: number): string {
  return addDays(today, -(days - 1))
}
