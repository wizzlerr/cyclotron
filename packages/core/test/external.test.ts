import { describe, expect, it } from 'vitest'
import {
  addDays,
  externalLoad,
  readinessFor,
  recommend,
  weekPlan,
  wellnessSignals,
  type DailyWellness,
  type RideRecord,
} from '../src'

const TODAY = '2026-10-22'

describe('externalLoad', () => {
  it('uses the source TSS when there is one', () => {
    expect(externalLoad({ durationS: 3600, tss: 70, intensity: 0.84 }, 171)).toEqual({
      tss: 70,
      intensity: 0.84,
    })
  })

  it('estimates TSS from heart rate otherwise', () => {
    // 36 min at 150 bpm with a threshold of 171: IF 0.877, about 46 TSS.
    const l = externalLoad({ durationS: 2183, avgHr: 150 }, 171)!
    expect(l.intensity).toBeCloseTo(150 / 171)
    expect(l.tss).toBeCloseTo((2183 / 3600) * (150 / 171) ** 2 * 100)
    expect(externalLoad({ durationS: 2183 }, 171)).toBeUndefined()
    expect(externalLoad({ durationS: 2183, avgHr: 150 }, undefined)).toBeUndefined()
  })
})

describe('wellnessSignals', () => {
  const day = (n: number, over: Partial<DailyWellness>): DailyWellness => ({
    date: addDays(TODAY, n),
    coverageH: 24,
    ...over,
  })

  it('flags a resting HR above the usual', () => {
    const days = [-5, -4, -3, -2, -1].map((n) => day(n, { restingHr: 50 }))
    expect(wellnessSignals([...days, day(0, { restingHr: 57 })], TODAY)).toEqual([
      { source: 'restingHr', kind: 'hrv', shift: -1 },
    ])
    expect(wellnessSignals([...days, day(0, { restingHr: 52 })], TODAY)).toEqual([])
  })

  it('uses Body Battery and short sleep when the watch was worn overnight', () => {
    expect(wellnessSignals([day(-1, {}), day(0, { bodyBatteryMax: 20 })], TODAY)).toContainEqual({
      source: 'bodyBattery',
      kind: 'readiness',
      shift: -1,
    })
    expect(wellnessSignals([day(-1, {}), day(0, { bodyBatteryMax: 90 })], TODAY)[0]!.shift).toBe(1)
    expect(wellnessSignals([day(0, { sleepS: 4 * 3600 })], TODAY)).toContainEqual({
      source: 'sleep',
      kind: 'sleep',
      shift: -1,
    })
  })

  it('stays silent for a watch worn only during workouts', () => {
    // Real pattern: "resting" HR measured during runs, a few hours of coverage, no sleep.
    const days = [-6, -4, -1].map((n) =>
      day(n, { restingHr: 120, coverageH: 3, bodyBatteryMax: 50 }),
    )
    const today = day(0, { restingHr: 129, coverageH: 4, bodyBatteryMax: 46 })
    expect(wellnessSignals([...days, today], TODAY)).toEqual([])
  })
})

describe('external activities in the engine', () => {
  const run = (n: number): RideRecord => ({
    date: addDays(TODAY, n),
    tss: 60,
    intensity: 0.9,
    durationS: 3000,
    zoneS: [0, 600, 1200, 1200, 0, 0, 0],
    external: true,
  })

  it('counts a hard run yesterday for readiness', () => {
    const load = [{ date: TODAY, tss: 0, ctl: 40, atl: 30, tsb: 10 }]
    expect(readinessFor(TODAY, load, [run(-1)]).reasons).toContainEqual({ code: 'hardYesterday' })
  })

  it("doesn't count runs as cycling hours or plan rides", () => {
    const rides = [-1, -2, -3, -4].map(run)
    const r = recommend({
      today: TODAY,
      weekday: 4,
      profile: { goal: 'ftp', weeklyHours: 3, rideDays: [] },
      minutes: 60,
      load: [{ date: TODAY, tss: 0, ctl: 40, atl: 40, tsb: 0 }],
      rides,
      candidates: [],
    })
    expect(r.reasons).not.toContainEqual(expect.objectContaining({ code: 'weeklyDone' }))
    const p = weekPlan({
      today: TODAY,
      weekday: 4,
      profile: { goal: 'ftp', weeklyHours: 3, rideDays: [] },
      ctl: 40,
      rides,
    })
    expect(p.days.every((d) => d.rides.length === 0)).toBe(true)
  })
})
