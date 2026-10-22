import { POWER_ZONES } from '../metrics/zones'
import type { Workout } from './model'
import { workoutProfile, workoutStats } from './stats'

// Per-workout metadata for the library and recommendations (E10-2, DESIGN.md §6.1, §7.3).

export const WORKOUT_TYPES = [
  'recovery',
  'endurance',
  'tempo',
  'sweetspot',
  'threshold',
  'vo2max',
  'anaerobic',
] as const

export type WorkoutType = (typeof WORKOUT_TYPES)[number]

interface TypeRule {
  /** Seconds at or above this fraction of FTP count as work for the type. */
  minPct: number
  /** Work needed for a workout to be classified as this type. */
  classifyS: number
  /** Typical target; work seconds are weighted by (pct / refPct)^4. */
  refPct: number
  /** Typical length of one work bout; longer bouts are harder. 0 = not an interval type. */
  boutS: number
  /** Weighted work (seconds) for difficulty 1 and 10, on a log scale. */
  level1S: number
  level10S: number
}

const RULES: Record<WorkoutType, TypeRule> = {
  recovery: { minPct: 0, classifyS: 0, refPct: 0.5, boutS: 0, level1S: 900, level10S: 57_600 },
  endurance: {
    minPct: 0.56,
    classifyS: 1200,
    refPct: 0.65,
    boutS: 0,
    level1S: 1_200,
    level10S: 21_600,
  },
  tempo: {
    minPct: 0.76,
    classifyS: 1200,
    refPct: 0.82,
    boutS: 900,
    level1S: 1_200,
    level10S: 12_000,
  },
  sweetspot: {
    minPct: 0.88,
    classifyS: 900,
    refPct: 0.9,
    boutS: 720,
    level1S: 900,
    level10S: 10_800,
  },
  threshold: {
    minPct: 0.95,
    classifyS: 600,
    refPct: 1.0,
    boutS: 600,
    level1S: 600,
    level10S: 7_200,
  },
  vo2max: { minPct: 1.06, classifyS: 360, refPct: 1.15, boutS: 180, level1S: 240, level10S: 3_600 },
  anaerobic: { minPct: 1.21, classifyS: 120, refPct: 1.4, boutS: 45, level1S: 90, level10S: 1_200 },
}

export interface WorkoutMeta {
  durationS: number
  intensity: number
  tss: number
  /** Seconds in power zones Z1…Z7 (planned targets; free ride counts as Z1, max effort as Z6). */
  zoneS: number[]
  /** The workout's own type when it is a known one, else classified from its targets. */
  type: WorkoutType
  /** 1–10 within its type, one decimal (DESIGN.md §7.3). */
  difficulty: number
}

export function isWorkoutType(t: string | undefined): t is WorkoutType {
  return (WORKOUT_TYPES as readonly string[]).includes(t ?? '')
}

export function workoutMeta(workout: Workout): WorkoutMeta {
  const profile = workoutProfile(workout)
  const stats = workoutStats(workout)
  const type = isWorkoutType(workout.type) ? workout.type : classifyProfile(profile)
  return {
    ...stats,
    zoneS: zoneSeconds(profile),
    type,
    difficulty: profileDifficulty(profile, type),
  }
}

/** The hardest type with enough work in it; recovery when there is none. */
export function classifyProfile(profile: readonly number[]): WorkoutType {
  for (let i = WORKOUT_TYPES.length - 1; i > 0; i--) {
    const type = WORKOUT_TYPES[i]!
    const rule = RULES[type]
    if (profile.filter((p) => p >= rule.minPct).length >= rule.classifyS) return type
  }
  return 'recovery'
}

/**
 * Difficulty 1–10 of a profile as a workout of `type`: weighted time at or above the type's
 * floor, scaled up for long bouts and short rests, on a log scale between the type's limits.
 */
export function profileDifficulty(profile: readonly number[], type: WorkoutType): number {
  const rule = RULES[type]
  let weighted = 0
  let work = 0
  let first = -1
  let last = -1
  let bouts = 0
  for (let t = 0; t < profile.length; t++) {
    const p = profile[t]!
    if (p < rule.minPct) continue
    weighted += Math.min(2, (p / rule.refPct) ** 4)
    work++
    if (first < 0) first = t
    if (last !== t - 1) bouts++
    last = t
  }
  if (work === 0) return 1
  let score = weighted
  if (rule.boutS > 0) {
    // Work over the span it's spread across: 1 for one block, 0.5 for 1:1 intervals.
    const density = work / (last - first + 1)
    const bout = work / bouts
    score *= (0.7 + 0.6 * density) * clamp((bout / rule.boutS) ** 0.25, 0.7, 1.3)
  }
  const f = Math.log(score / rule.level1S) / Math.log(rule.level10S / rule.level1S)
  return Math.round((1 + 9 * clamp(f, 0, 1)) * 10) / 10
}

function zoneSeconds(profile: readonly number[]): number[] {
  const out = POWER_ZONES.map(() => 0)
  for (const p of profile) out[POWER_ZONES.findIndex((z) => p <= z.maxPct)]!++
  return out
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
