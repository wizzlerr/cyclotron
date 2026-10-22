import type { WorkoutType } from '../workout/meta'
import type { Workout } from '../workout/model'

// Recommendation engine inputs and outputs (E11, DESIGN.md §7). Everything is data: reasons are
// codes with values, worded by the UI (D21).

export type Goal = 'fitness' | 'ftp' | 'endurance' | 'vo2'

export const GOALS: readonly Goal[] = ['fitness', 'ftp', 'endurance', 'vo2']

export type Readiness = 'fresh' | 'normal' | 'fatigued' | 'very_fatigued'

export const READINESS: readonly Readiness[] = ['fresh', 'normal', 'fatigued', 'very_fatigued']

export type RideFeedback = 'easy' | 'right' | 'hard' | 'failed'

/** One finished ride, as the engine sees it. */
export interface RideRecord {
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  workoutId?: string
  /** From the workout's metadata; missing for free rides and imports. */
  type?: WorkoutType
  difficulty?: number
  tss: number
  intensity: number
  /** Moving time, seconds. */
  durationS: number
  /** Seconds in power zones Z1…Z7. */
  zoneS: readonly number[]
  feedback?: RideFeedback
  /** Share of work seconds ridden at ≥ 85 % of target (see `targetHit`). */
  targetHit?: number
  /** Moving time over the workout's planned time. */
  completed?: number
}

/**
 * Optional outside input, e.g. Garmin training readiness or HRV (E11-11, wired in E12-6).
 * `shift` moves readiness: −1 = one step more tired, +1 = one step fresher.
 */
export interface ReadinessSignal {
  source: string
  kind: 'readiness' | 'hrv' | 'sleep' | 'load' | 'other'
  shift: -2 | -1 | 0 | 1
}

/** A workout the engine may pick (built-in or the rider's own; not FTP tests). */
export interface Candidate {
  id: string
  type: WorkoutType
  difficulty: number
  durationS: number
}

export interface RecoProfile {
  goal: Goal
  /** Hours per week the rider wants to train. */
  weeklyHours: number
  /** Days of the week the rider trains, 0 = Sunday … 6 = Saturday; empty = any day. */
  rideDays: readonly number[]
}

export type Reason =
  | { code: 'readiness'; readiness: Readiness; tsb: number }
  | { code: 'hardYesterday' }
  | { code: 'twoHardDays' }
  | { code: 'recentFail' }
  | { code: 'signal'; source: string; shift: number }
  | { code: 'goal'; goal: Goal; type: WorkoutType }
  | { code: 'tooMuchIntensity'; highPct: number }
  | { code: 'roomForIntensity'; highPct: number }
  | { code: 'notDoneFor'; type: WorkoutType; days: number | null }
  | { code: 'weeklyDone'; hours: number; target: number }
  | { code: 'restDay' }
  | { code: 'level'; type: WorkoutType; level: number; difficulty: number }
  | { code: 'noFit'; type: WorkoutType; minutes: number }

export interface Pick {
  id: string
  type: WorkoutType
  difficulty: number
  /** Set when the workout was made to measure (E11-10) rather than taken from the library. */
  generated?: Workout
  durationS: number
}

export interface Recommendation {
  readiness: Readiness
  /** Form (TSB) going into today. */
  tsb: number
  /** Rest is suggested; `main` is then an easy option for riding anyway. */
  rest: boolean
  main?: Pick
  easier?: Pick
  shorter?: Pick
  levels: Record<WorkoutType, number>
  /** Why, in order of importance. */
  reasons: Reason[]
}
