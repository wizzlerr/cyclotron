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

/**
 * The workout's main work: of the types from tempo up with enough work at or above their floor,
 * the one with the most time in its own band (up to the next type's floor) relative to the work
 * it needs. So 3 × 10 min sweet spot with a few short surges is sweet spot, not anaerobic.
 * Endurance when no harder type has enough work, recovery when endurance hasn't either.
 */
export function classifyProfile(profile: readonly number[]): WorkoutType {
  let best: WorkoutType | undefined
  let bestScore = -1
  // Hardest first, so a tie goes to the harder type.
  for (let i = WORKOUT_TYPES.length - 1; i >= 2; i--) {
    const type = WORKOUT_TYPES[i]!
    const rule = RULES[type]
    const next = WORKOUT_TYPES[i + 1]
    const top = next ? RULES[next].minPct : Infinity
    let above = 0
    let inBand = 0
    for (const p of profile) {
      if (p < rule.minPct) continue
      above++
      if (p < top) inBand++
    }
    if (above < rule.classifyS) continue
    const score = inBand / rule.classifyS
    if (score > bestScore) {
      bestScore = score
      best = type
    }
  }
  if (best) return best
  const endurance = RULES.endurance
  return profile.filter((p) => p >= endurance.minPct).length >= endurance.classifyS
    ? 'endurance'
    : 'recovery'
}

/** One recorded second, for `rideWork`. */
export interface WorkSample {
  powerW?: number | null
  /** Lap or workout step; seconds of one segment are scored at the segment's average. */
  segment?: number | null
  paused?: boolean
}

/** Seconds averaged when a ride has no laps to go by. */
const SMOOTH_S = 30
/** A ride needs this many laps for them to be its intervals. */
const MIN_LAPS = 3

/**
 * Type and difficulty of what a ride actually was, from its power (E11-14): free rides, route
 * rides and imports (e.g. Zwift workouts) count for the levels too. A ride with laps (a Zwift
 * workout writes one per interval, ours one per step) is scored at each lap's average power, as
 * planned workouts are; without laps, at a 30 s rolling average. Undefined without power.
 */
export function rideWork(
  samples: readonly WorkSample[],
  ftpW: number,
): { type: WorkoutType; difficulty: number } | undefined {
  const moving = samples.filter((s) => !s.paused)
  if (ftpW <= 0 || !moving.some((s) => (s.powerW ?? 0) > 0)) return undefined
  const power = moving.map((s) => s.powerW ?? 0)
  const laps = new Set(moving.map((s) => s.segment ?? null))
  const profile: number[] = []
  if (!laps.has(null) && laps.size >= MIN_LAPS) {
    let start = 0
    for (let i = 1; i <= moving.length; i++) {
      if (i < moving.length && moving[i]!.segment === moving[start]!.segment) continue
      let sum = 0
      for (let j = start; j < i; j++) sum += power[j]!
      const pct = sum / (i - start) / ftpW
      for (let j = start; j < i; j++) profile.push(pct)
      start = i
    }
  } else {
    let sum = 0
    for (let i = 0; i < power.length; i++) {
      sum += power[i]!
      if (i >= SMOOTH_S) sum -= power[i - SMOOTH_S]!
      profile.push(sum / Math.min(i + 1, SMOOTH_S) / ftpW)
    }
  }
  const type = classifyProfile(profile)
  return { type, difficulty: profileDifficulty(profile, type) }
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
