import { addDays, type DailyLoad } from '../metrics/load'
import { generateWorkout } from '../workout/generate'
import { workoutMeta, WORKOUT_TYPES, type WorkoutType } from '../workout/meta'
import { daysBetween, progressionLevels, windowStart } from './levels'
import { isHard, readinessFor } from './readiness'
import type {
  Candidate,
  Goal,
  Pick,
  Readiness,
  ReadinessSignal,
  Reason,
  Recommendation,
  RecoProfile,
  RideRecord,
} from './types'

// "What should I ride today?" (E11-4, E11-5, DESIGN.md §7.2): score the workout types, then pick
// the workout of the best type whose difficulty is closest to the rider's level plus a stretch.

export interface RecoInput {
  /** Local date, YYYY-MM-DD. */
  today: string
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number
  profile: RecoProfile
  /** Time the rider has today. */
  minutes: number
  load: readonly DailyLoad[]
  rides: readonly RideRecord[]
  candidates: readonly Candidate[]
  signals?: readonly ReadinessSignal[]
  /** Make a workout to measure when the library has nothing close (E11-10). Default true. */
  generate?: boolean
}

const GOAL_WEIGHTS: Record<Goal, Record<WorkoutType, number>> = {
  fitness: {
    recovery: 0.2,
    endurance: 1.0,
    tempo: 0.8,
    sweetspot: 1.0,
    threshold: 0.7,
    vo2max: 0.7,
    anaerobic: 0.4,
  },
  ftp: {
    recovery: 0.2,
    endurance: 0.7,
    tempo: 0.6,
    sweetspot: 1.2,
    threshold: 1.2,
    vo2max: 0.8,
    anaerobic: 0.3,
  },
  endurance: {
    recovery: 0.2,
    endurance: 1.3,
    tempo: 1.0,
    sweetspot: 0.8,
    threshold: 0.5,
    vo2max: 0.4,
    anaerobic: 0.2,
  },
  vo2: {
    recovery: 0.2,
    endurance: 0.8,
    tempo: 0.4,
    sweetspot: 0.6,
    threshold: 0.8,
    vo2max: 1.3,
    anaerobic: 0.7,
  },
}

/** Types that count as hard days. */
const HARD_TYPES: ReadonlySet<WorkoutType> = new Set([
  'sweetspot',
  'threshold',
  'vo2max',
  'anaerobic',
])
/** Easier fallback for each type, for the "easier" alternative. */
const EASIER: Record<WorkoutType, WorkoutType> = {
  recovery: 'recovery',
  endurance: 'recovery',
  tempo: 'endurance',
  sweetspot: 'tempo',
  threshold: 'sweetspot',
  vo2max: 'threshold',
  anaerobic: 'vo2max',
}
/** Difficulty stretch on top of the level (DESIGN.md §7.2 step 3). */
const STRETCH: Record<Readiness, number> = {
  fresh: 0.6,
  normal: 0.2,
  fatigued: -1,
  very_fatigued: -1.5,
}
/** Above this share of time in Z3+ over 7 days, ease off intensity (80/20). */
const HIGH_MAX = 0.25
const HIGH_MIN = 0.1
/** Library workouts further than this from the target difficulty are replaced by a generated one. */
const GENERATE_OFF = 1
/** …and only when the generated one is at least this much closer. */
const GENERATE_GAIN = 0.5
/** Done within this many days: prefer another workout. */
const REPEAT_DAYS = 14

export function recommend(input: RecoInput): Recommendation {
  const { today, profile, rides } = input
  const ctl = input.load.find((d) => d.date === today)?.ctl ?? input.load.at(-1)?.ctl ?? 0
  const levels = progressionLevels(rides, today, ctl)
  const ready = readinessFor(today, input.load, rides, input.signals)
  const reasons: Reason[] = [...ready.reasons]
  const week = rides.filter((r) => r.date >= windowStart(today, 7) && r.date <= today)

  // Rest: very tired, not a ride day, or the week's hours are already in.
  const weekHours = week.reduce((s, r) => s + r.durationS, 0) / 3600
  let rest = ready.readiness === 'very_fatigued'
  if (profile.rideDays.length > 0 && !profile.rideDays.includes(input.weekday)) {
    rest = true
    reasons.push({ code: 'restDay' })
  }
  if (profile.weeklyHours > 0 && weekHours >= profile.weeklyHours) {
    rest = true
    reasons.push({ code: 'weeklyDone', hours: round1(weekHours), target: profile.weeklyHours })
  }

  const scores = scoreTypes(input, ready.readiness, rest, week, reasons)
  const ranked = WORKOUT_TYPES.filter((t) => scores[t] > -Infinity).sort(
    (a, b) => scores[b] - scores[a],
  )

  const stretch = STRETCH[ready.readiness]
  const maxS = input.minutes * 60 * 1.05
  const choose = (
    type: WorkoutType,
    limitS: number,
    target: number,
    exclude: string[],
  ): Pick | undefined => {
    const lib = bestOf(input, type, limitS, maxS, target, exclude)
    if (input.generate === false || (lib && Math.abs(lib.difficulty - target) <= GENERATE_OFF)) {
      return lib
    }
    // Nothing in the library within a level of the target: make one, inside the time chosen.
    const w = generateWorkout(type, target, Math.min(limitS, input.minutes * 60))
    if (!w || exclude.includes(w.id)) return lib
    const m = workoutMeta(w)
    // Hand-made workouts win unless the generated one is clearly closer.
    if (
      lib &&
      Math.abs(lib.difficulty - target) - Math.abs(m.difficulty - target) < GENERATE_GAIN
    ) {
      return lib
    }
    return { id: w.id, type, difficulty: m.difficulty, durationS: m.durationS, generated: w }
  }

  // Recovery is the last resort when nothing else fits the time.
  if (!ranked.includes('recovery')) ranked.push('recovery')
  let main: Pick | undefined
  for (const type of ranked) {
    main = choose(type, maxS, levels[type] + stretch, [])
    if (main) break
    if (type === ranked[0]) reasons.push({ code: 'noFit', type, minutes: input.minutes })
  }
  if (!main) return { readiness: ready.readiness, tsb: ready.tsb, rest, levels, reasons }

  if (!rest && ready.readiness !== 'fatigued') {
    reasons.push({ code: 'goal', goal: profile.goal, type: main.type })
  }
  const days = daysSince(rides, main.type, today)
  if (HARD_TYPES.has(main.type) && (days === null || days >= 10)) {
    reasons.push({ code: 'notDoneFor', type: main.type, days })
  }
  reasons.push({
    code: 'level',
    type: main.type,
    level: levels[main.type],
    difficulty: main.difficulty,
  })

  // Easier: the same type well below, else the next easier type. Shorter: same type, ≤ 75 %.
  const sameEasier = choose(main.type, maxS, main.difficulty - 1.5, [main.id])
  const easier =
    sameEasier && sameEasier.difficulty <= main.difficulty - 0.5
      ? sameEasier
      : EASIER[main.type] !== main.type
        ? choose(EASIER[main.type], maxS, levels[EASIER[main.type]] - 0.5, [main.id])
        : undefined
  // Shorter: the same type, else one or two types easier (never harder, and not a recovery
  // spin in place of a hard day).
  let shorter: Pick | undefined
  const i = WORKOUT_TYPES.indexOf(main.type)
  const easierTypes = WORKOUT_TYPES.slice(Math.max(0, i - 2), i).reverse()
  for (const type of [main.type, ...easierTypes]) {
    shorter = choose(type, main.durationS * 0.75, levels[type] + stretch, [
      main.id,
      easier?.id ?? '',
    ])
    if (shorter) break
  }

  return {
    readiness: ready.readiness,
    tsb: ready.tsb,
    rest,
    main,
    easier,
    shorter,
    levels,
    reasons,
  }
}

function daysSince(rides: readonly RideRecord[], type: WorkoutType, today: string): number | null {
  let last: string | undefined
  for (const r of rides)
    if (r.type === type && r.date < today && (!last || r.date > last)) last = r.date
  return last ? daysBetween(last, today) : null
}

function scoreTypes(
  input: RecoInput,
  readiness: Readiness,
  rest: boolean,
  week: readonly RideRecord[],
  reasons: Reason[],
): Record<WorkoutType, number> {
  const weights = GOAL_WEIGHTS[input.profile.goal]
  const scores = { ...weights }
  const allow = (t: WorkoutType): boolean =>
    rest || readiness === 'very_fatigued'
      ? t === 'recovery'
      : readiness === 'fatigued'
        ? t === 'recovery' || t === 'endurance'
        : t !== 'recovery'
  for (const t of WORKOUT_TYPES) if (!allow(t)) scores[t] = -Infinity
  if (readiness === 'fatigued') scores.endurance += 0.5

  if (readiness === 'fresh') for (const t of HARD_TYPES) scores[t] += 0.3

  // 80/20 balance over the last 7 days.
  const zones = week.reduce(
    (acc, r) => acc.map((s, i) => s + (r.zoneS[i] ?? 0)),
    [0, 0, 0, 0, 0, 0, 0],
  )
  const total = zones.reduce((a, b) => a + b, 0)
  const highPct = total > 0 ? zones.slice(2).reduce((a, b) => a + b, 0) / total : 0
  if (total >= 3600 && highPct > HIGH_MAX) {
    for (const t of HARD_TYPES) scores[t] -= 0.4
    scores.tempo -= 0.2
    scores.endurance += 0.3
    reasons.push({ code: 'tooMuchIntensity', highPct: Math.round(highPct * 100) })
  } else if (total >= 7200 && highPct < HIGH_MIN) {
    for (const t of HARD_TYPES) scores[t] += 0.2
    reasons.push({ code: 'roomForIntensity', highPct: Math.round(highPct * 100) })
  }

  // Recency: don't repeat a hard type within 2 days; bring back types not done for a while.
  for (const t of WORKOUT_TYPES) {
    if (scores[t] === -Infinity) continue
    const days = daysSince(input.rides, t, input.today)
    if (HARD_TYPES.has(t) && days !== null && days <= 2) scores[t] -= 0.6
    else if (weights[t] >= 0.7 && (days === null || days >= 10)) scores[t] += 0.2
  }
  if (input.rides.some((r) => r.date === addDays(input.today, -1) && isHard(r))) {
    for (const t of HARD_TYPES) if (scores[t] > -Infinity) scores[t] -= 0.3
  }
  return scores
}

/**
 * The workout of `type` up to `limitS` long with difficulty closest to `target`, preferring ones
 * that use most of the rider's time (`availS`).
 */
function bestOf(
  input: RecoInput,
  type: WorkoutType,
  limitS: number,
  availS: number,
  target: number,
  exclude: readonly string[],
): Pick | undefined {
  const recent = new Set(
    input.rides
      .filter((r) => r.workoutId && daysBetween(r.date, input.today) < REPEAT_DAYS)
      .map((r) => r.workoutId!),
  )
  let best: { c: Candidate; score: number } | undefined
  for (const c of input.candidates) {
    if (c.type !== type || c.durationS > limitS || exclude.includes(c.id)) continue
    // Overshooting the target is worse than undershooting; leaving much of the time unused and
    // repeats are mild penalties.
    const off = c.difficulty - target
    const unused = Math.max(0, 0.8 - c.durationS / availS)
    const score = (off > 0 ? off * 1.5 : -off) + unused * 1.5 + (recent.has(c.id) ? 0.7 : 0)
    if (!best || score < best.score) best = { c, score }
  }
  return best && { ...best.c }
}

const round1 = (n: number): number => Math.round(n * 10) / 10
