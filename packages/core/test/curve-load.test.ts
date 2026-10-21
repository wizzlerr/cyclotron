import { describe, expect, it } from 'vitest'
import { addDays, dailyLoad, localDate, powerCurve, zoneTimes } from '../src'

describe('powerCurve', () => {
  it('gives the best average for each duration the ride covers', () => {
    // 60 s at 200 W with a 5 s burst of 500 W in the middle.
    const power = Array.from({ length: 60 }, (_, i) => (i >= 30 && i < 35 ? 500 : 200))
    const curve = powerCurve(power)
    expect(curve.map((p) => p.durationS)).toEqual([1, 5, 10, 15, 30, 60])
    expect(curve[0]!.watts).toBe(500)
    expect(curve[1]!.watts).toBe(500)
    expect(curve[2]!.watts).toBe(350)
    expect(curve[5]!.watts).toBe(225)
  })
})

describe('zoneTimes', () => {
  it('counts seconds per Coggan zone', () => {
    // FTP 200: 100 W = Z1 (50 %), 140 W = Z2 (70 %), 200 W = Z4 (100 %), 400 W = Z7 (200 %).
    const t = zoneTimes([100, 100, 140, 200, 200, 200, 400], 200)
    expect(t).toEqual([2, 1, 0, 3, 0, 0, 1])
  })
})

describe('dailyLoad', () => {
  it('follows the CTL/ATL/TSB formulas, with rest days as 0 TSS', () => {
    const days = dailyLoad(new Map([['2026-10-01', 100]]), '2026-10-01', '2026-10-03')
    expect(days.map((d) => d.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03'])
    // Day 1: CTL = 100/42, ATL = 100/7; form going in is 0.
    expect(days[0]).toMatchObject({ tss: 100, ctl: 2.4, atl: 14.3, tsb: 0 })
    // Day 2: form = yesterday's CTL − ATL.
    expect(days[1]!.tsb).toBeCloseTo(100 / 42 - 100 / 7, 0)
    expect(days[2]!.atl).toBeLessThan(days[1]!.atl)
  })

  it('does date arithmetic across months and in local time', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    // 23:30 UTC is already the next day in CEST (+120 min).
    expect(localDate(Date.UTC(2026, 9, 21, 23, 30), 120)).toBe('2026-10-22')
  })
})
