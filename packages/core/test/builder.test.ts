import { describe, expect, it } from 'vitest'
import {
  BUILTIN_WORKOUTS,
  buildTimeline,
  newStep,
  parseDuration,
  parseZwo,
  validateWorkout,
  workoutStats,
  workoutToZwo,
  type Workout,
} from '../src'

const workout: Workout = {
  id: 'w',
  name: 'Over & Unders <hard>',
  type: 'threshold',
  description: 'Built in "Cyclotron"',
  source: 'custom',
  steps: [
    newStep('warmup'),
    { kind: 'steady', durationS: 300, pct: 0.88, cadence: 95 },
    {
      kind: 'repeat',
      count: 3,
      steps: [
        { kind: 'steady', durationS: 120, pct: 1.05, cadence: 100 },
        { kind: 'steady', durationS: 60, pct: 0.55, cadence: 85 },
      ],
    },
    {
      kind: 'repeat',
      count: 2,
      steps: [
        { kind: 'ramp', durationS: 60, fromPct: 0.9, toPct: 1.2 },
        { kind: 'steady', durationS: 30, pct: 0.5 },
        { kind: 'steady', durationS: 30, pct: 0.6 },
      ],
    },
    newStep('freeride'),
    newStep('maxeffort'),
    newStep('cooldown'),
  ],
}

describe('workoutToZwo', () => {
  it('round-trips through parseZwo to the same ride', () => {
    const xml = workoutToZwo(workout)
    expect(xml).toContain('<Warmup Duration="600" PowerLow="0.4" PowerHigh="0.75"/>')
    expect(xml).toContain('<IntervalsT Repeat="3" OnDuration="120" OffDuration="60"')
    expect(xml).toContain('<Cooldown Duration="600"')
    expect(xml).toContain('Over &amp; Unders &lt;hard&gt;')

    const back = parseZwo(xml, 'back')
    expect(back.name).toBe(workout.name)
    expect(back.description).toBe(workout.description)
    expect(back.type).toBe('threshold')
    // Same second-by-second plan, even though the 3-step repeat was written out.
    const a = buildTimeline(workout.steps)
    const b = buildTimeline(back.steps)
    expect(b.map((s) => [s.kind, s.durationS, s.fromPct, s.toPct])).toEqual(
      a.map((s) => [s.kind, s.durationS, s.fromPct, s.toPct]),
    )
    expect(workoutStats(back)).toEqual(workoutStats(workout))
  })
})

describe('validateWorkout', () => {
  it('accepts a good workout and explains what is wrong with a bad one', () => {
    expect(validateWorkout(workout)).toEqual([])
    const bad: Workout = {
      id: 'b',
      name: ' ',
      steps: [
        { kind: 'steady', durationS: 0, pct: 0.8 },
        { kind: 'ramp', durationS: 60, fromPct: 0.5, toPct: 4 },
        { kind: 'repeat', count: 0, steps: [] },
      ],
    }
    expect(validateWorkout(bad)).toEqual([
      { code: 'noName' },
      { code: 'duration', path: [0] },
      { code: 'power', path: [1] },
      { code: 'repeatCount', path: [2] },
      { code: 'emptyRepeat', path: [2] },
    ])
    expect(validateWorkout({ id: 'e', name: 'Empty', steps: [] })).toEqual([{ code: 'noSteps' }])
  })

  it('accepts every built-in workout, so a duplicate can be saved (nested repeats included)', () => {
    for (const w of BUILTIN_WORKOUTS) expect(validateWorkout(w), w.name).toEqual([])
  })
})

describe('parseDuration', () => {
  it('reads m:ss, h:mm:ss and plain minutes', () => {
    expect(parseDuration('5:00')).toBe(300)
    expect(parseDuration(' 0:45 ')).toBe(45)
    expect(parseDuration('1:30:00')).toBe(5400)
    expect(parseDuration('20')).toBe(1200)
    expect(parseDuration('5:75')).toBeUndefined()
    expect(parseDuration('abc')).toBeUndefined()
    expect(parseDuration('')).toBeUndefined()
  })
})
