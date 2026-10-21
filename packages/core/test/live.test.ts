import { describe, expect, it } from 'vitest'
import {
  heartRateZone,
  LiveRideMetrics,
  summarizeRide,
  TimeWindowAverage,
  type RideSample,
} from '../src'

/** Varied power with a pause and some missing values. */
function samples(): RideSample[] {
  const out: RideSample[] = []
  for (let t = 1; t <= 900; t++) {
    out.push({
      t,
      powerW: t % 120 < 40 ? 300 : 150 + (t % 7),
      cadenceRpm: t % 50 === 0 ? 0 : 90,
      heartRateBpm: t % 30 === 0 ? undefined : 120 + (t % 40),
      paused: t > 400 && t <= 430,
    })
  }
  return out
}

describe('LiveRideMetrics', () => {
  it('matches summarizeRide over the same samples', () => {
    const live = new LiveRideMetrics(250, 70)
    for (const s of samples()) live.add(s)
    const m = live.snapshot()
    const ref = summarizeRide(samples(), 250)
    expect(m.timerS).toBe(ref.timerS)
    expect(m.avgPowerW).toBeCloseTo(ref.avgPowerW, 9)
    expect(m.maxPowerW).toBe(ref.maxPowerW)
    expect(m.normalizedPowerW).toBeCloseTo(ref.normalizedPowerW, 9)
    expect(m.intensity).toBeCloseTo(ref.intensity, 9)
    expect(m.tss).toBeCloseTo(ref.tss, 9)
    expect(m.workKj).toBeCloseTo(ref.workKj, 9)
    expect(m.avgHeartRateBpm).toBeCloseTo(ref.avgHeartRateBpm!, 9)
    expect(m.maxHeartRateBpm).toBe(ref.maxHeartRateBpm)
    expect(m.avgCadenceRpm).toBeCloseTo(ref.avgCadenceRpm!, 9)
    expect(m.avgWattsPerKg).toBeCloseTo(ref.avgPowerW / 70, 9)
  })

  it('falls back to average power before 30 s', () => {
    const live = new LiveRideMetrics(200)
    for (let t = 1; t <= 10; t++) live.add({ t, powerW: 200 })
    expect(live.snapshot()).toMatchObject({ normalizedPowerW: 200, intensity: 1 })
    expect(live.snapshot().avgWattsPerKg).toBeUndefined()
  })
})

describe('TimeWindowAverage', () => {
  it('averages values inside the window only', () => {
    const a = new TimeWindowAverage(3000)
    expect(a.average(0)).toBeUndefined()
    a.add(0, 100)
    a.add(1000, 200)
    a.add(2000, 300)
    expect(a.average(2000)).toBe(200)
    expect(a.average(3500)).toBe(250) // the value at t=0 has left the window
    expect(a.average(10_000)).toBeUndefined()
  })
})

describe('heartRateZone', () => {
  it('uses % of max HR', () => {
    expect(heartRateZone(100, 190)).toBe(1)
    expect(heartRateZone(133, 190)).toBe(2)
    expect(heartRateZone(171, 190)).toBe(4)
    expect(heartRateZone(200, 190)).toBe(5)
  })
})
