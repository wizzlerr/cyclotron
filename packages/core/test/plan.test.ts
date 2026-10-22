import { describe, expect, it } from 'vitest'
import {
  BUILTIN_WORKOUTS,
  planDay,
  recommend,
  weekPlan,
  workoutMeta,
  type Candidate,
  type PlanInput,
  type RecoInput,
} from '../src'

// 2026-10-22 is a Thursday; its week starts on Monday 2026-10-19.
const TODAY = '2026-10-22'
const input = (over: Partial<PlanInput['profile']> = {}, ctl = 40): PlanInput => ({
  today: TODAY,
  weekday: 4,
  profile: { goal: 'ftp', weeklyHours: 6, rideDays: [2, 4, 6, 0], ...over },
  ctl,
  rides: [],
})

describe('weekPlan', () => {
  it('lays out Monday to Sunday over the training days', () => {
    const p = weekPlan(input())
    expect(p.weekStart).toBe('2026-10-19')
    expect(p.days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(p.days.filter((d) => d.kind !== 'rest').map((d) => d.weekday)).toEqual([2, 4, 6, 0])
    expect(p.defaultDays).toBe(false)
  })

  it('puts the long ride at the weekend and spreads hard days apart', () => {
    const p = weekPlan(input())
    expect(p.days.find((d) => d.kind === 'long')!.weekday).toBe(0)
    const hard = p.days.filter((d) => d.kind === 'hard')
    expect(hard).toHaveLength(2)
    // Tue and Thu or Tue and Sat: never two hard days in a row.
    const idx = hard.map((d) => p.days.indexOf(d))
    expect(idx[1]! - idx[0]!).toBeGreaterThan(1)
    expect(hard[0]!.type).toBe('threshold')
  })

  it('shares the weekly time, the long day most', () => {
    const p = weekPlan(input())
    const total = p.days.reduce((s, d) => s + d.minutes, 0)
    expect(total).toBeGreaterThanOrEqual(6 * 60 - 30)
    expect(total).toBeLessThanOrEqual(6 * 60 + 30)
    const long = p.days.find((d) => d.kind === 'long')!
    expect(long.minutes).toBe(Math.max(...p.days.map((d) => d.minutes)))
  })

  it('caps the load so fitness rises safely', () => {
    const p = weekPlan(input({ weeklyHours: 15, rideDays: [1, 2, 3, 4, 5, 6, 0] }, 10))
    expect(p.capped).toBe(true)
    expect(p.plannedTss).toBeLessThanOrEqual(7 * (10 + 52) + 30)
  })

  it('chooses days when the rider has not', () => {
    const p = weekPlan(input({ rideDays: [], weeklyHours: 3 }))
    expect(p.defaultDays).toBe(true)
    expect(p.days.filter((d) => d.kind !== 'rest')).toHaveLength(3)
  })

  it('shows what was ridden on each day', () => {
    const ride = {
      date: '2026-10-20',
      tss: 60,
      intensity: 0.8,
      durationS: 3600,
      zoneS: [0, 0, 0, 0, 0, 0, 0],
    }
    const short = { ...ride, date: '2026-10-21', durationS: 60 }
    const p = weekPlan({ ...input(), rides: [ride, short] })
    expect(planDay(p, '2026-10-20')!.rides).toHaveLength(1)
    expect(planDay(p, '2026-10-21')!.rides).toHaveLength(0)
    expect(planDay(p, '2026-10-26')).toBeUndefined()
  })
})

describe('recommend with a plan', () => {
  const candidates: Candidate[] = BUILTIN_WORKOUTS.map((w) => {
    const m = workoutMeta(w)
    return { id: w.id, type: m.type, difficulty: m.difficulty, durationS: m.durationS }
  })
  const reco = (over: Partial<RecoInput>): ReturnType<typeof recommend> =>
    recommend({
      today: TODAY,
      weekday: 4,
      profile: { goal: 'ftp', weeklyHours: 6, rideDays: [2, 4, 6, 0] },
      minutes: 75,
      load: [{ date: TODAY, tss: 0, ctl: 40, atl: 35, tsb: 5 }],
      rides: [],
      candidates,
      ...over,
    })
  const day = (kind: 'hard' | 'easy' | 'rest', type?: 'vo2max') => ({
    date: TODAY,
    weekday: 4,
    kind,
    type,
    minutes: 75,
    rides: [],
  })

  it('follows a hard day of the plan', () => {
    const r = reco({ planDay: day('hard', 'vo2max') })
    expect(r.main!.type).toBe('vo2max')
    expect(r.reasons).toContainEqual({ code: 'planHard', type: 'vo2max' })
  })

  it('keeps an easy day easy and suggests rest on a rest day', () => {
    expect(reco({ planDay: day('easy') }).main!.type).toBe('endurance')
    const rest = reco({ planDay: day('rest') })
    expect(rest.rest).toBe(true)
    expect(rest.reasons).toContainEqual({ code: 'planRest' })
  })

  it('lets readiness overrule a hard day', () => {
    const r = reco({
      planDay: day('hard', 'vo2max'),
      load: [{ date: TODAY, tss: 0, ctl: 40, atl: 55, tsb: -15 }],
    })
    expect(['recovery', 'endurance']).toContain(r.main!.type)
  })
})
