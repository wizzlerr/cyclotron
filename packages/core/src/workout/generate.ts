import { profileDifficulty, WORKOUT_TYPES, type WorkoutType } from './meta'
import type { Workout, WorkoutStep } from './model'
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

const FAMILIES: Record<WorkoutType, Family> = {
  recovery: {
    counts: [1],
    onS: range(min(10), min(120), min(5)),
    pcts: [0.5],
    off: () => 0,
    offPct: 0.5,
    warmupS: min(5),
    steady: true,
  },
  endurance: {
    counts: [1],
    onS: range(min(15), min(240), min(5)),
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
    counts: [2, 3, 4, 5],
    onS: [6, 8, 10, 12, 15, 20].map(min),
    pcts: [0.88, 0.9, 0.92],
    off: (on) => Math.max(min(3), Math.round(on / 3 / 60) * 60),
    offPct: 0.55,
    warmupS: min(10),
  },
  threshold: {
    counts: [2, 3, 4, 5, 6],
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
 * The workout of `type` up to `maxS` long whose difficulty is closest to `target`, or undefined
 * when even the shortest shape doesn't fit. Interval workouts are topped up with easy riding to
 * use the time (`fill`).
 */
export function generateWorkout(
  type: WorkoutType,
  target: number,
  maxS: number,
  fill = true,
): Workout | undefined {
  const f = FAMILIES[type]
  let best: { spec: GenSpec; off: number } | undefined
  for (const count of f.counts) {
    for (const onS of f.onS) {
      const offS = f.off(onS)
      // The last interval has no recovery after it; the cooldown follows.
      const base = f.warmupS + count * onS + (count - 1) * offS + COOLDOWN_S
      if (base > maxS) continue
      for (const onPct of f.pcts) {
        // Scored without the filler: easy riding after the last interval can't change an
        // interval workout's difficulty, and the profile stays short.
        const spec: GenSpec = { type, count, onS, onPct, offS, offPct: f.offPct, fillS: 0 }
        const off = Math.abs(profileDifficulty(workoutProfile(specWorkout(spec)), type) - target)
        if (!best || off < best.off - 1e-9) best = { spec, off }
      }
    }
  }
  if (!best) return undefined
  const s = best.spec
  const base = f.warmupS + s.count * s.onS + (s.count - 1) * s.offS + COOLDOWN_S
  const fillS = fill && !f.steady ? Math.floor((maxS - base) / 60) * 60 : 0
  return specWorkout({ ...s, fillS })
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
    { kind: 'ramp', durationS: f.warmupS, fromPct: 0.45, toPct: warmTo },
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
