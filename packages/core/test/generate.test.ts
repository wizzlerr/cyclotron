import { describe, expect, it } from 'vitest'
import {
  BUILTIN_WORKOUTS,
  generatedWorkout,
  generateWorkout,
  isGeneratedId,
  parseGeneratedId,
  recommend,
  workoutMeta,
  WORKOUT_TYPES,
  type Candidate,
  type RecoInput,
  type RideRecord,
} from '../src'

describe('generateWorkout', () => {
  it('hits reachable targets for every type and gets harder as the target rises', () => {
    for (const type of WORKOUT_TYPES) {
      // Higher levels need more time than 2 h for the steady types (difficulty grows with volume).
      const hard = workoutMeta(generateWorkout(type, 8, 120 * 60)!).difficulty
      expect(hard).toBeGreaterThan(workoutMeta(generateWorkout(type, 4, 120 * 60)!).difficulty)
      for (const target of [2, 4]) {
        const w = generateWorkout(type, target, 120 * 60)!
        const m = workoutMeta(w)
        expect(m.type, w.id).toBe(type)
        expect(m.durationS, w.id).toBeLessThanOrEqual(120 * 60)
        expect(Math.abs(m.difficulty - target), `${w.id} → ${m.difficulty}`).toBeLessThanOrEqual(
          0.7,
        )
      }
    }
  })

  it('fills the time with easy riding around intervals', () => {
    const w = generateWorkout('threshold', 4, 90 * 60)!
    expect(workoutMeta(w).durationS).toBeGreaterThan(85 * 60)
  })

  it("returns nothing when even the shortest shape doesn't fit", () => {
    expect(generateWorkout('threshold', 5, 15 * 60)).toBeUndefined()
  })

  it('rebuilds the same workout from its id', () => {
    const w = generateWorkout('vo2max', 5, 60 * 60)!
    expect(isGeneratedId(w.id)).toBe(true)
    expect(generatedWorkout(w.id)).toEqual(w)
    expect(parseGeneratedId('gen.nope.1x60@500.0@500.f0')).toBeUndefined()
    expect(parseGeneratedId('builtin.recovery.20')).toBeUndefined()
  })
})

describe('recommend with generated workouts', () => {
  const TODAY = '2026-10-22'
  const candidates: Candidate[] = BUILTIN_WORKOUTS.map((w) => {
    const m = workoutMeta(w)
    return { id: w.id, type: m.type, difficulty: m.difficulty, durationS: m.durationS }
  })
  // A strong sweet spot rider: well above anything in the library.
  const rides: RideRecord[] = [-30, -25, -20, -15, -10].map((d, i) => ({
    date: new Date(Date.UTC(2026, 9, 22 + d)).toISOString().slice(0, 10),
    type: 'sweetspot',
    difficulty: 8 + i * 0.4,
    feedback: 'easy',
    tss: 90,
    intensity: 0.84,
    durationS: 5400,
    zoneS: [600, 1800, 600, 2400, 0, 0, 0],
  }))
  const input: RecoInput = {
    today: TODAY,
    weekday: 4,
    profile: { goal: 'ftp', weeklyHours: 8, rideDays: [] },
    minutes: 150,
    load: [{ date: TODAY, tss: 0, ctl: 60, atl: 50, tsb: 10 }],
    rides,
    candidates,
  }

  it('makes a workout to measure when the library is too easy', () => {
    const r = recommend(input)
    expect(r.main!.type).toBe('sweetspot')
    expect(r.main!.generated).toBeDefined()
    expect(r.main!.id).toBe(r.main!.generated!.id)
    // Harder than anything in the library (Sweet Spot 3×20 is 7.5), as close to the target as the
    // time allows.
    expect(r.main!.difficulty).toBeGreaterThan(7.5)
    expect(r.main!.durationS).toBeLessThanOrEqual(150 * 60)
  })

  it('sticks to the library when told not to generate', () => {
    const r = recommend({ ...input, generate: false })
    expect(r.main!.generated).toBeUndefined()
  })
})
