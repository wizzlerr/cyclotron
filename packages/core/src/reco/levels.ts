import { addDays } from '../metrics/load'
import { WORKOUT_TYPES, type WorkoutType } from '../workout/meta'
import { MIN_COUNTED_S, rideFailed } from './readiness'
import type { RideRecord } from './types'

// Progression levels (E11-3, E11-7, E11-14, DESIGN.md §7.3): one level 1–10 per workout type,
// replayed from the ride history every time, so there is nothing to store or migrate when the rules
// change. Rides without a workout (free, route, imported) count by what they were (`rideWork`).

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
/**
 * The first rides of a type move the level all the way (E11-14): the starting levels are guesses,
 * and at `STEP` a rider well above them took months of too-easy workouts to get there.
 */
const CALIBRATION_RIDES = 3
/** Feedback bonus on the workout's difficulty: easy means the rider can go higher. */
const BONUS = { easy: 1, right: 0.2, hard: -0.2, none: 0.1 } as const
/**
 * "Easy" on a workout near the level counts from the level, not from the workout's difficulty:
 * otherwise a rider who finds the picks easy never moves, as the picks sit at the level already.
 */
const EASY_NEAR = 1
/**
 * Levels slowly fall when a type isn't trained: after a grace period, per day, by 2 levels at most
 * and not below the starting level.
 */
const DECAY_AFTER_DAYS = 14
const DECAY_PER_DAY = 0.02
const MAX_DECAY = 2

export type Levels = Record<WorkoutType, number>

/** `ctl`: current fitness, for the starting levels. */
export function progressionLevels(rides: readonly RideRecord[], today: string, ctl = 0): Levels {
  const levels = Object.fromEntries(WORKOUT_TYPES.map((t) => [t, startLevel(t, ctl)])) as Levels
  const last: Partial<Record<WorkoutType, string>> = {}
  const count: Partial<Record<WorkoutType, number>> = {}
  const decay = (type: WorkoutType, to: string): void => {
    const from = last[type]
    if (!from) return
    const idle = daysBetween(from, to) - DECAY_AFTER_DAYS
    if (idle <= 0) return
    // Never below where a new rider starts: a long break makes the rider new to the type, not
    // worse than new (a level already below it after failed rides stays where it is).
    const floor = Math.min(levels[type], startLevel(type, ctl))
    levels[type] = Math.max(floor, levels[type] - Math.min(MAX_DECAY, idle * DECAY_PER_DAY))
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
      const base =
        r.feedback === 'easy' && r.difficulty >= level - EASY_NEAR
          ? Math.max(level, r.difficulty)
          : r.difficulty
      const target = base + bonus
      const step = (count[r.type] ?? 0) < CALIBRATION_RIDES ? 1 : STEP
      if (target > level) levels[r.type] = Math.min(10, level + (target - level) * step)
    }
    count[r.type] = (count[r.type] ?? 0) + 1
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
