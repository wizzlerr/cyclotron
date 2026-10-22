import { addDays } from '../metrics/load'
import type { WorkoutType } from '../workout/meta'
import { daysBetween } from './levels'
import { MIN_COUNTED_S } from './readiness'
import type { Goal, RecoProfile, RideRecord } from './types'

// Weekly plan (E11-9, DESIGN.md §7.5): hard days spread over the rider's training days, a long
// endurance ride at the weekend, easy days in between, and a cap on weekly load so fitness (CTL)
// rises by at most ~8 a week. Today's recommendation follows the plan, adjusted by readiness.

export type PlanKind = 'rest' | 'easy' | 'hard' | 'long'

export interface PlanDay {
  /** YYYY-MM-DD. */
  date: string
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number
  kind: PlanKind
  /** Workout type for the day; none on rest days. */
  type?: WorkoutType
  minutes: number
  /** Rides on this day (5 min or longer). */
  rides: RideRecord[]
}

export interface WeekPlan {
  /** Monday of the week. */
  weekStart: string
  days: PlanDay[]
  /** Training days were not set: the plan chose them. */
  defaultDays: boolean
  plannedTss: number
  /** Load was cut to keep the fitness ramp safe. */
  capped: boolean
}

export interface PlanInput {
  today: string
  /** Weekday of `today`, 0 = Sunday. */
  weekday: number
  profile: RecoProfile
  /** Current fitness. */
  ctl: number
  rides: readonly RideRecord[]
}

/** Hard-day types in the order they're used, per goal. */
const HARD_ROTATION: Record<Goal, WorkoutType[]> = {
  fitness: ['sweetspot', 'vo2max', 'threshold'],
  ftp: ['threshold', 'sweetspot', 'vo2max'],
  endurance: ['tempo', 'sweetspot', 'tempo'],
  vo2: ['vo2max', 'threshold', 'anaerobic'],
}
/** Rough IF of a session of each kind, for planned TSS. */
const SESSION_IF: Record<WorkoutType, number> = {
  recovery: 0.55,
  endurance: 0.68,
  tempo: 0.78,
  sweetspot: 0.82,
  threshold: 0.84,
  vo2max: 0.82,
  anaerobic: 0.78,
}
/** Share of the week's time per kind of day, relative to each other. */
const SHARE: Record<Exclude<PlanKind, 'rest'>, number> = { hard: 1, easy: 0.8, long: 1.6 }
/** CTL gains ~0.154 × (daily TSS − CTL) a week; +8 a week allows daily TSS of CTL + 52. */
const RAMP_DAILY_TSS = 52

/** Training days the plan uses when the rider hasn't chosen any, by weekly hours. */
export function defaultRideDays(weeklyHours: number): number[] {
  if (weeklyHours < 4) return [2, 4, 6]
  if (weeklyHours < 7) return [2, 4, 6, 0]
  if (weeklyHours < 10) return [2, 3, 5, 6, 0]
  return [2, 3, 4, 5, 6, 0]
}

export function weekPlan(input: PlanInput): WeekPlan {
  const { profile } = input
  // Weeks run Monday to Sunday; index 0 = Monday.
  const mondayIndex = (input.weekday + 6) % 7
  const weekStart = addDays(input.today, -mondayIndex)
  const defaultDays = profile.rideDays.length === 0
  const rideDays = defaultDays ? defaultRideDays(profile.weeklyHours) : profile.rideDays
  const riding = [0, 1, 2, 3, 4, 5, 6].filter((i) => rideDays.includes((i + 1) % 7))

  // Long ride: the last weekend training day, else the last one. Not for very short weeks.
  const weekend = riding.filter((i) => i >= 5)
  const long = riding.length >= 3 ? (weekend.at(-1) ?? riding.at(-1)) : undefined
  const hardCount = Math.min(
    profile.goal === 'endurance' ? 2 : 3,
    riding.length <= 2 ? 1 : Math.floor(riding.length / 2),
  )
  const hard = placeHard(
    riding.filter((i) => i !== long),
    hardCount,
    long,
  )

  const kinds = Array.from({ length: 7 }, (_, i): PlanKind =>
    !riding.includes(i) ? 'rest' : i === long ? 'long' : hard.includes(i) ? 'hard' : 'easy',
  )
  const shares = kinds.map((k) => (k === 'rest' ? 0 : SHARE[k]))
  const shareSum = shares.reduce((a, b) => a + b, 0) || 1
  const rotation = HARD_ROTATION[profile.goal]
  const types = kinds.map((k, i): WorkoutType | undefined =>
    k === 'rest'
      ? undefined
      : k === 'hard'
        ? rotation[hard.indexOf(i) % rotation.length]
        : 'endurance',
  )
  let minutes = shares.map((s) => (s * profile.weeklyHours * 60) / shareSum)

  // Cap the week's load so CTL rises by at most ~8.
  const tssOf = (m: number[]): number =>
    m.reduce(
      (sum, mins, i) => sum + (types[i] ? (mins / 60) * SESSION_IF[types[i]!] ** 2 * 100 : 0),
      0,
    )
  const capTss = 7 * (input.ctl + RAMP_DAILY_TSS)
  const planned = tssOf(minutes)
  const capped = planned > capTss
  if (capped) minutes = minutes.map((m) => (m * capTss) / planned)
  minutes = minutes.map((m, i) => (kinds[i] === 'rest' ? 0 : clampMinutes(m)))

  const days = kinds.map((kind, i): PlanDay => {
    const date = addDays(weekStart, i)
    return {
      date,
      weekday: (i + 1) % 7,
      kind,
      type: types[i],
      minutes: minutes[i]!,
      rides: input.rides.filter((r) => r.date === date && r.durationS >= MIN_COUNTED_S),
    }
  })
  return { weekStart, days, defaultDays, plannedTss: Math.round(tssOf(minutes)), capped }
}

/**
 * Picks `count` days from `candidates` (Monday-based indexes) so hard days are as far apart as
 * possible, counting the gap into next week; ties prefer not riding hard the day before or after
 * the long ride, then earlier days.
 */
function placeHard(candidates: number[], count: number, long: number | undefined): number[] {
  let best: { days: number[]; score: number[] } | undefined
  for (const combo of combinations(candidates, Math.min(count, candidates.length))) {
    const gaps = combo.map((d, i) => (i + 1 < combo.length ? combo[i + 1]! - d : combo[0]! + 7 - d))
    const nextToLong = long === undefined ? 0 : combo.filter((d) => Math.abs(d - long) === 1).length
    const score = [Math.min(...gaps), -nextToLong, -combo.reduce((a, b) => a + b, 0)]
    if (!best || compare(score, best.score) > 0) best = { days: combo, score }
  }
  return best?.days ?? []
}

function combinations(items: number[], k: number): number[][] {
  if (k === 0) return [[]]
  const out: number[][] = []
  items.forEach((item, i) => {
    for (const rest of combinations(items.slice(i + 1), k - 1)) out.push([item, ...rest])
  })
  return out
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!
  return 0
}

/** 15 min steps, 30 min to 4 h. */
function clampMinutes(m: number): number {
  return Math.min(240, Math.max(30, Math.round(m / 15) * 15))
}

/** The plan's entry for `date`, if it's in the week. */
export function planDay(plan: WeekPlan, date: string): PlanDay | undefined {
  const i = daysBetween(plan.weekStart, date)
  return i >= 0 && i < 7 ? plan.days[i] : undefined
}
