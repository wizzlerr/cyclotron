import { describe, expect, it } from 'vitest'
import {
  BUILTIN_WORKOUTS,
  classifyProfile,
  workoutMeta,
  workoutProfile,
  WORKOUT_TYPES,
  type Workout,
  type WorkoutStep,
} from '../src'

const workout = (steps: WorkoutStep[], type?: string): Workout => ({
  id: 'w',
  name: 'w',
  type,
  steps,
})
const minutes = (m: number): number => m * 60

describe('workoutMeta', () => {
  it('counts planned seconds per power zone', () => {
    const m = workoutMeta(
      workout([
        { kind: 'steady', durationS: 600, pct: 0.5 },
        { kind: 'steady', durationS: 300, pct: 1.0 },
        { kind: 'maxeffort', durationS: 20 },
      ]),
    )
    expect(m.zoneS).toEqual([600, 0, 0, 300, 0, 20, 0])
    expect(m.durationS).toBe(920)
  })

  it('classifies by the hardest type with enough work', () => {
    const at = (pct: number, m: number): number[] => Array<number>(minutes(m)).fill(pct)
    expect(classifyProfile(at(0.5, 60))).toBe('recovery')
    expect(classifyProfile(at(0.68, 60))).toBe('endurance')
    expect(classifyProfile(at(0.82, 30))).toBe('tempo')
    expect(classifyProfile(at(0.9, 20))).toBe('sweetspot')
    expect(classifyProfile(at(1.0, 15))).toBe('threshold')
    expect(classifyProfile([...at(0.6, 30), ...at(1.15, 8)])).toBe('vo2max')
    expect(classifyProfile([...at(0.6, 30), ...at(1.5, 3)])).toBe('anaerobic')
    // A minute of bursts doesn't turn an endurance ride into an anaerobic one.
    expect(classifyProfile([...at(0.68, 60), ...at(1.5, 1)])).toBe('endurance')
  })

  it('keeps a known type and classifies unknown ones', () => {
    const steps: WorkoutStep[] = [{ kind: 'steady', durationS: minutes(30), pct: 0.9 }]
    expect(workoutMeta(workout(steps, 'tempo')).type).toBe('tempo')
    expect(workoutMeta(workout(steps, 'my stuff')).type).toBe('sweetspot')
  })

  it('rates longer, denser and harder work as more difficult', () => {
    const d = (steps: WorkoutStep[]): number => workoutMeta(workout(steps, 'threshold')).difficulty
    const intervals = (count: number, onM: number, pct: number, offM: number): WorkoutStep => ({
      kind: 'repeat',
      count,
      steps: [
        { kind: 'steady', durationS: minutes(onM), pct },
        { kind: 'steady', durationS: minutes(offM), pct: 0.55 },
      ],
    })
    const base = d([intervals(3, 10, 0.98, 5)])
    expect(d([intervals(4, 10, 0.98, 5)])).toBeGreaterThan(base)
    expect(d([intervals(3, 10, 0.98, 2)])).toBeGreaterThan(base)
    expect(d([intervals(3, 10, 1.03, 5)])).toBeGreaterThan(base)
    expect(d([intervals(6, 5, 0.98, 5)])).toBeLessThan(base)
    expect(d([{ kind: 'steady', durationS: minutes(30), pct: 0.5 }])).toBe(1)
  })

  it('stays within 1–10', () => {
    const huge = workoutMeta(workout([{ kind: 'steady', durationS: minutes(300), pct: 1.1 }]))
    expect(huge.difficulty).toBe(10)
  })
})

describe('built-in library', () => {
  const metas = BUILTIN_WORKOUTS.map((w) => ({ w, m: workoutMeta(w) }))

  it('has unique ids and 30–50 workouts covering every type', () => {
    expect(new Set(BUILTIN_WORKOUTS.map((w) => w.id)).size).toBe(BUILTIN_WORKOUTS.length)
    expect(BUILTIN_WORKOUTS.length).toBeGreaterThanOrEqual(30)
    expect(BUILTIN_WORKOUTS.length).toBeLessThanOrEqual(50)
    for (const t of WORKOUT_TYPES)
      expect(metas.filter(({ m }) => m.type === t).length).toBeGreaterThanOrEqual(4)
  })

  it('tags every workout with the type its targets classify as', () => {
    for (const { w, m } of metas) {
      expect(classifyProfile(workoutProfile(w)), w.id).toBe(m.type)
    }
  })

  it('spreads difficulty within each type', () => {
    for (const t of WORKOUT_TYPES) {
      const ds = metas.filter(({ m }) => m.type === t).map(({ m }) => m.difficulty)
      expect(Math.max(...ds) - Math.min(...ds), t).toBeGreaterThanOrEqual(2)
    }
  })
})
