import { describe, expect, it } from 'vitest'
import {
  addDays,
  BUILTIN_WORKOUTS,
  progressionLevels,
  readinessFor,
  recommend,
  rideFailed,
  startLevel,
  targetHit,
  workoutMeta,
  type Candidate,
  type DailyLoad,
  type RecoInput,
  type RideRecord,
} from '../src'

const TODAY = '2026-10-22' // a Thursday
const day = (n: number): string => addDays(TODAY, n)
const load = (tsb: number): DailyLoad[] => [{ date: TODAY, tss: 0, ctl: 50, atl: 50 - tsb, tsb }]

const ride = (over: Partial<RideRecord>): RideRecord => ({
  date: day(-1),
  tss: 50,
  intensity: 0.7,
  durationS: 3600,
  zoneS: [600, 3000, 0, 0, 0, 0, 0],
  ...over,
})

const CANDIDATES: Candidate[] = BUILTIN_WORKOUTS.map((w) => {
  const m = workoutMeta(w)
  return { id: w.id, type: m.type, difficulty: m.difficulty, durationS: m.durationS }
})

const input = (over: Partial<RecoInput> = {}): RecoInput => ({
  today: TODAY,
  weekday: 4,
  profile: { goal: 'ftp', weeklyHours: 6, rideDays: [] },
  minutes: 75,
  load: load(0),
  rides: [],
  candidates: CANDIDATES,
  ...over,
})

describe('readiness', () => {
  it('follows TSB bands', () => {
    expect(readinessFor(TODAY, load(10), []).readiness).toBe('fresh')
    expect(readinessFor(TODAY, load(0), []).readiness).toBe('normal')
    expect(readinessFor(TODAY, load(-15), []).readiness).toBe('fatigued')
    expect(readinessFor(TODAY, load(-30), []).readiness).toBe('very_fatigued')
    expect(readinessFor(TODAY, [], []).readiness).toBe('normal')
  })

  it('is at most normal after a hard day and fatigued after two', () => {
    const hard = (d: number): RideRecord => ride({ date: day(d), intensity: 0.9 })
    expect(readinessFor(TODAY, load(10), [hard(-1)]).readiness).toBe('normal')
    expect(readinessFor(TODAY, load(10), [hard(-1), hard(-2)]).readiness).toBe('fatigued')
  })

  it('gets one step more tired after a failed workout and follows outside signals', () => {
    expect(readinessFor(TODAY, load(0), [ride({ feedback: 'failed' })]).readiness).toBe('fatigued')
    const signal = { source: 'garmin', kind: 'readiness', shift: -1 } as const
    const r = readinessFor(TODAY, load(10), [], [signal])
    expect(r.readiness).toBe('normal')
    expect(r.reasons).toContainEqual({ code: 'signal', source: 'garmin', shift: -1 })
  })
})

describe('failed rides', () => {
  it('counts missed targets, cut-short workouts and the rider saying so', () => {
    expect(rideFailed(ride({ feedback: 'failed' }))).toBe(true)
    expect(rideFailed(ride({ targetHit: 0.7 }))).toBe(true)
    expect(rideFailed(ride({ completed: 0.5 }))).toBe(true)
    expect(rideFailed(ride({ targetHit: 0.95, completed: 1 }))).toBe(false)
    // A start abandoned within seconds isn't a failed workout.
    expect(rideFailed(ride({ durationS: 6, completed: 0.001 }))).toBe(false)
  })

  it('measures target hit over work seconds only', () => {
    const s = (power: number, target: number) => ({ power, target })
    const samples = [
      ...Array.from({ length: 100 }, () => s(250, 250)),
      ...Array.from({ length: 50 }, () => s(150, 250)),
      ...Array.from({ length: 300 }, () => s(50, 100)), // recovery: not work
    ]
    expect(targetHit(samples, 250)).toBeCloseTo(100 / 150)
    expect(targetHit(samples.slice(0, 30), 250)).toBeUndefined()
  })
})

describe('progression levels', () => {
  const ss = (d: number, over: Partial<RideRecord> = {}): RideRecord =>
    ride({ date: day(d), type: 'sweetspot', difficulty: 5, ...over })

  it('starts everyone at the same level', () => {
    expect(progressionLevels([], TODAY).threshold).toBe(startLevel('threshold'))
    expect(progressionLevels([], TODAY, 60).threshold).toBe(startLevel('threshold') + 2)
  })

  it('rises toward completed workouts, more when they felt easy', () => {
    const right = progressionLevels([ss(-3, { feedback: 'right' })], TODAY).sweetspot
    const easy = progressionLevels([ss(-3, { feedback: 'easy' })], TODAY).sweetspot
    const hard = progressionLevels([ss(-3, { feedback: 'hard' })], TODAY).sweetspot
    expect(right).toBeGreaterThan(startLevel('sweetspot'))
    expect(easy).toBeGreaterThan(right)
    expect(hard).toBeLessThan(right)
    // Easy workouts below the level don't lower it.
    expect(progressionLevels([ss(-3, { difficulty: 1 })], TODAY).sweetspot).toBe(
      startLevel('sweetspot'),
    )
  })

  it('drops after a failed workout', () => {
    const l = progressionLevels([ss(-5), ss(-3, { difficulty: 4, feedback: 'failed' })], TODAY)
    expect(l.sweetspot).toBeLessThan(progressionLevels([ss(-5)], TODAY).sweetspot)
  })

  it('decays when a type is not trained for weeks', () => {
    const recent = progressionLevels([ss(-3, { difficulty: 7 })], TODAY).sweetspot
    const old = progressionLevels([ss(-60, { difficulty: 7 })], TODAY).sweetspot
    expect(old).toBeLessThan(recent)
    expect(old).toBeGreaterThanOrEqual(1)
  })
})

describe('recommend', () => {
  it('picks a workout for the goal that fits the time, with alternatives', () => {
    const r = recommend(input({ load: load(10) }))
    expect(r.rest).toBe(false)
    expect(['sweetspot', 'threshold']).toContain(r.main!.type)
    expect(r.main!.durationS).toBeLessThanOrEqual(75 * 60 * 1.05)
    expect(r.easier!.difficulty).toBeLessThan(r.main!.difficulty)
    expect(r.shorter!.durationS).toBeLessThan(r.main!.durationS)
    expect(r.reasons[0]).toMatchObject({ code: 'readiness', readiness: 'fresh' })
    expect(r.reasons).toContainEqual(expect.objectContaining({ code: 'level', type: r.main!.type }))
  })

  it('keeps a fatigued rider easy and a very tired one on rest', () => {
    const tired = recommend(input({ load: load(-15) }))
    expect(['recovery', 'endurance']).toContain(tired.main!.type)
    const spent = recommend(input({ load: load(-30) }))
    expect(spent.rest).toBe(true)
    expect(spent.main!.type).toBe('recovery')
  })

  it('suggests rest on a day off and when the week is done', () => {
    const dayOff = recommend(
      input({ profile: { goal: 'ftp', weeklyHours: 6, rideDays: [1, 3, 5] } }),
    )
    expect(dayOff.rest).toBe(true)
    expect(dayOff.reasons).toContainEqual({ code: 'restDay' })
    const rides = [-1, -2, -3].map((d) => ride({ date: day(d), durationS: 2.5 * 3600 }))
    const done = recommend(input({ rides }))
    expect(done.rest).toBe(true)
    expect(done.reasons).toContainEqual(expect.objectContaining({ code: 'weeklyDone' }))
  })

  it('backs off intensity after an intense week (80/20)', () => {
    const intense = [-2, -3, -4].map((d) =>
      ride({ date: day(d), zoneS: [300, 900, 600, 1800, 0, 0, 0] }),
    )
    const r = recommend(
      input({ rides: intense, profile: { goal: 'fitness', weeklyHours: 10, rideDays: [] } }),
    )
    expect(r.reasons).toContainEqual(expect.objectContaining({ code: 'tooMuchIntensity' }))
    expect(['endurance', 'tempo']).toContain(r.main!.type)
  })

  it("doesn't repeat yesterday's hard type and aims higher as the level rises", () => {
    const thr = ride({ date: day(-1), type: 'threshold', difficulty: 5, intensity: 0.88 })
    const r = recommend(input({ load: load(10), rides: [thr] }))
    expect(r.main!.type).not.toBe('threshold')

    const ssAt = (d: number, difficulty: number): RideRecord =>
      ride({ date: day(d), type: 'sweetspot', difficulty, feedback: 'easy' })
    const strong = [ssAt(-20, 6), ssAt(-16, 7), ssAt(-12, 7.5)]
    const base = recommend(input({ profile: { goal: 'fitness', weeklyHours: 6, rideDays: [] } }))
    const later = recommend(
      input({
        rides: strong,
        profile: { goal: 'fitness', weeklyHours: 6, rideDays: [] },
        minutes: 120,
      }),
    )
    if (base.main!.type === 'sweetspot' && later.main!.type === 'sweetspot') {
      expect(later.main!.difficulty).toBeGreaterThan(base.main!.difficulty)
    }
    expect(later.levels.sweetspot).toBeGreaterThan(base.levels.sweetspot)
  })

  it('falls back to another type when nothing of the best one fits the time', () => {
    const r = recommend(input({ minutes: 25 }))
    expect(r.main!.durationS).toBeLessThanOrEqual(25 * 60 * 1.05)
  })
})
