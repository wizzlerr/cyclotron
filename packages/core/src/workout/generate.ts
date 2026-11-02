import { profileDifficulty, WORKOUT_TYPES, type WorkoutType } from './meta'
import { buildTimeline, type Workout, type WorkoutStep } from './model'
import { workoutProfile } from './stats'

// Workouts made to measure (E11-10): when the library has nothing close to the rider's level for
// the time they have, search a small family of shapes per type for the one whose difficulty is
// closest to the target. The id encodes the whole workout, so a ride of it can be rebuilt later
// (levels need its type and difficulty) without storing anything.

export interface GenSpec {
  type: WorkoutType
  count: number
  onS: number
  /** Fraction of FTP. */
  onPct: number
  offS: number
  offPct: number
  /** Easy riding after the intervals, to use the rider's time. */
  fillS: number
}

const PREFIX = 'gen.'
const FILL_PCT = 0.65

interface Family {
  counts: readonly number[]
  onS: readonly number[]
  pcts: readonly number[]
  /** Recovery length from the interval length. */
  off: (onS: number) => number
  offPct: number
  warmupS: number
  /** Steady types: one block, no filler (the block itself is the easy riding). */
  steady?: boolean
}

const min = (m: number): number => m * 60
const range = (from: number, to: number, step: number): number[] => {
  const out: number[] = []
  for (let v = from; v <= to; v += step) out.push(v)
  return out
}

/** Steady blocks: to the minute up to an hour (rides of 23 or 51 min), then 5 min steps. */
const STEADY_S = [...range(min(5), min(60), min(1)), ...range(min(65), min(240), min(5))]

const FAMILIES: Record<WorkoutType, Family> = {
  recovery: {
    counts: [1],
    onS: STEADY_S.filter((s) => s <= min(120)),
    pcts: [0.5],
    off: () => 0,
    offPct: 0.5,
    warmupS: min(5),
    steady: true,
  },
  endurance: {
    counts: [1],
    onS: STEADY_S,
    pcts: [0.65, 0.68, 0.7],
    off: () => 0,
    offPct: 0.6,
    warmupS: min(10),
    steady: true,
  },
  tempo: {
    counts: [1, 2, 3, 4],
    onS: [10, 15, 20, 25, 30].map(min),
    pcts: [0.8, 0.83, 0.86],
    off: () => min(5),
    offPct: 0.6,
    warmupS: min(10),
  },
  sweetspot: {
    // One long block too: 1×30 min is a variant of 3×10 min.
    counts: [1, 2, 3, 4, 5],
    onS: [6, 8, 10, 12, 15, 20].map(min),
    pcts: [0.88, 0.9, 0.92],
    off: (on) => Math.max(min(3), Math.round(on / 3 / 60) * 60),
    offPct: 0.55,
    warmupS: min(10),
  },
  threshold: {
    counts: [1, 2, 3, 4, 5, 6],
    onS: [5, 6, 8, 10, 12, 15, 20].map(min),
    pcts: [0.95, 0.98, 1.0, 1.03],
    off: (on) => Math.max(min(3), Math.round(on / 2 / 60) * 60),
    offPct: 0.55,
    warmupS: min(10),
  },
  vo2max: {
    counts: [3, 4, 5, 6, 7, 8],
    onS: [2, 3, 4, 5].map(min),
    pcts: [1.08, 1.12, 1.15, 1.2],
    off: (on) => on,
    offPct: 0.5,
    warmupS: min(12),
  },
  anaerobic: {
    counts: [4, 5, 6, 8, 10, 12],
    onS: [20, 30, 45, 60, 90],
    pcts: [1.25, 1.35, 1.5, 1.7],
    off: (on) => Math.max(60, on * 3),
    offPct: 0.5,
    warmupS: min(12),
  },
}

const COOLDOWN_S = min(5)

/**
 * Warm-up length. Steady blocks under 15 min (short easy rides, e.g. a 23 min run swapped for a
 * ride) get a warm-up of half the block, at least 3 min; longer ones keep the family's (so ids
 * of rides made before still rebuild the same workout).
 */
function warmupFor(f: Family, onS: number): number {
  if (!f.steady || onS >= min(15)) return f.warmupS
  return Math.min(f.warmupS, Math.max(min(3), Math.round(onS / 2 / 60) * 60))
}

/**
 * The workout of `type` up to `maxS` long whose difficulty is closest to `target`, or undefined
 * when even the shortest shape doesn't fit. Interval workouts are topped up with easy riding to
 * use the time (`fill`). Steady workouts shorter than `minS` are skipped (a ride of a set length,
 * e.g. in place of a run the watch prescribed).
 */
export function generateWorkout(
  type: WorkoutType,
  target: number,
  maxS: number,
  fill = true,
  minS = 0,
): Workout | undefined {
  return generateOptions(type, target, maxS, fill, minS)[0]
}

/**
 * One workout per interval shape (count × length), each at the power that brings it closest to
 * `target`, closest first: the variants of a workout (3×6 min, 2×9 min, 1×18 min …). Steady types
 * only have one shape that matters, so they return at most one.
 */
export function generateOptions(
  type: WorkoutType,
  target: number,
  maxS: number,
  fill = true,
  minS = 0,
): Workout[] {
  const f = FAMILIES[type]
  const best = new Map<string, { spec: GenSpec; off: number }>()
  for (const count of f.counts) {
    for (const onS of f.onS) {
      const offS = f.off(onS)
      // The last interval has no recovery after it; the cooldown follows.
      const base = warmupFor(f, onS) + count * onS + (count - 1) * offS + COOLDOWN_S
      if (base > maxS || (f.steady && base < minS)) continue
      const key = f.steady ? '' : `${count}x${onS}`
      for (const onPct of f.pcts) {
        // Scored without the filler: easy riding after the last interval can't change an
        // interval workout's difficulty, and the profile stays short.
        const spec: GenSpec = { type, count, onS, onPct, offS, offPct: f.offPct, fillS: 0 }
        const off = Math.abs(profileDifficulty(workoutProfile(specWorkout(spec)), type) - target)
        const prev = best.get(key)
        if (!prev || off < prev.off - 1e-9) best.set(key, { spec, off })
      }
    }
  }
  // Stable order: closest first, then fewer intervals, then shorter ones.
  const sorted = [...best.values()].sort(
    (a, b) => a.off - b.off || a.spec.count - b.spec.count || a.spec.onS - b.spec.onS,
  )
  return sorted.map(({ spec: s }) => {
    const base = warmupFor(f, s.onS) + s.count * s.onS + (s.count - 1) * s.offS + COOLDOWN_S
    const fillS = fill && !f.steady ? Math.floor((maxS - base) / 60) * 60 : 0
    return specWorkout({ ...s, fillS })
  })
}

/**
 * The intervals of a workout as `<count>x<seconds>` (e.g. "2x900" for 2 × 15 min), or undefined
 * when its hard parts aren't equal steady blocks (over-unders, pyramids, ramps). Lets a library
 * workout and a generated one with the same intervals count as one variant.
 */
export function workShape(w: Workout): string | undefined {
  const spec = parseGeneratedId(w.id)
  if (spec) return `${spec.count}x${spec.onS}`
  const segs = buildTimeline(w.steps).filter((s) => s.kind === 'steady')
  const top = Math.max(0, ...segs.map((s) => s.fromPct))
  if (top < 0.75) return undefined
  const work = segs.filter((s) => s.fromPct >= top * 0.85)
  const d = work[0]!.durationS
  return work.every((s) => s.durationS === d) ? `${work.length}x${d}` : undefined
}

/**
 * What makes generated workouts the same for "ridden recently": type and intervals, not the
 * power or the easy riding added to fill the time. Other ids are their own key.
 */
export function shapeKey(id: string): string {
  const s = parseGeneratedId(id)
  return s ? `${PREFIX}${s.type}.${s.count}x${s.onS}` : id
}

export function isGeneratedId(id: string): boolean {
  return id.startsWith(PREFIX)
}

/** `gen.<type>.<count>x<onS>@<onPct‰>.<offS>@<offPct‰>.f<fillS>` */
export function generatedId(s: GenSpec): string {
  const pm = (p: number): number => Math.round(p * 1000)
  return `${PREFIX}${s.type}.${s.count}x${s.onS}@${pm(s.onPct)}.${s.offS}@${pm(s.offPct)}.f${s.fillS}`
}

/** The spec behind a generated id, or undefined if it isn't one. */
export function parseGeneratedId(id: string): GenSpec | undefined {
  const m = /^gen\.([a-z0-9]+)\.(\d+)x(\d+)@(\d+)\.(\d+)@(\d+)\.f(\d+)$/.exec(id)
  if (!m || !(WORKOUT_TYPES as readonly string[]).includes(m[1]!)) return undefined
  const n = m.slice(2).map(Number) as [number, number, number, number, number, number]
  const [count, onS, onPm, offS, offPm, fillS] = n
  if (count < 1 || count > 50 || onS < 1 || onS > 6 * 3600 || fillS > 6 * 3600) return undefined
  return {
    type: m[1] as WorkoutType,
    count,
    onS,
    onPct: onPm / 1000,
    offS,
    offPct: offPm / 1000,
    fillS,
  }
}

/** Rebuilds a generated workout from its id. */
export function generatedWorkout(id: string): Workout | undefined {
  const spec = parseGeneratedId(id)
  return spec && specWorkout(spec)
}

export function specWorkout(s: GenSpec): Workout {
  const f = FAMILIES[s.type]
  const warmTo = s.onPct >= 1.05 ? 0.75 : Math.min(0.7, s.onPct)
  const steps: WorkoutStep[] = [
    { kind: 'ramp', durationS: warmupFor(f, s.onS), fromPct: 0.45, toPct: warmTo },
  ]
  const on: WorkoutStep = { kind: 'steady', durationS: s.onS, pct: s.onPct }
  if (s.count === 1) steps.push(on)
  else {
    steps.push({
      kind: 'repeat',
      count: s.count - 1,
      steps: [on, { kind: 'steady', durationS: s.offS, pct: s.offPct }],
    })
    steps.push(on)
  }
  if (s.fillS > 0) steps.push({ kind: 'steady', durationS: s.fillS, pct: FILL_PCT })
  steps.push({ kind: 'ramp', durationS: COOLDOWN_S, fromPct: 0.6, toPct: 0.4 })
  return {
    id: generatedId(s),
    // Worded by the UI from the spec (DESIGN.md D21); this is the plain fallback.
    name: s.count === 1 ? `${Math.round(s.onS / 60)} min` : `${s.count} × ${formatOn(s.onS)}`,
    type: s.type,
    source: 'generated',
    steps,
  }
}

const formatOn = (s: number): string => (s < 60 ? `${s} s` : `${Math.round(s / 60)} min`)
