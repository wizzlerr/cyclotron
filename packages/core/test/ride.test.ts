import { Decoder, Stream } from '@garmin/fitsdk'
import { describe, expect, it } from 'vitest'
import {
  caloriesKcal,
  encodeFitActivity,
  fitFileName,
  rideLaps,
  summarizeInterval,
  summarizeRide,
  type RideSample,
} from '../src'

/** 10 min at 200 W in segment 0, 30 s paused, 5 min at 100 W in segment 1. */
function ride(): RideSample[] {
  const out: RideSample[] = []
  let t = 1
  for (let i = 0; i < 600; i++) {
    out.push({ t: t++, powerW: 200, cadenceRpm: 90, speedKmh: 36, heartRateBpm: 150, segment: 0 })
  }
  for (let i = 0; i < 30; i++) out.push({ t: t++, powerW: 0, segment: 1, paused: true })
  for (let i = 0; i < 300; i++) {
    out.push({ t: t++, powerW: 100, cadenceRpm: 0, speedKmh: 18, heartRateBpm: 120, segment: 1 })
  }
  return out
}

describe('summarizeRide', () => {
  it('ignores paused samples in averages and timer time', () => {
    const s = summarizeRide(ride(), 200)
    expect(s.elapsedS).toBe(930)
    expect(s.timerS).toBe(900)
    expect(s.avgPowerW).toBeCloseTo((600 * 200 + 300 * 100) / 900)
    expect(s.maxPowerW).toBe(200)
    expect(s.avgCadenceRpm).toBe(90) // zeros (coasting) don't count
    expect(s.avgHeartRateBpm).toBeCloseTo((600 * 150 + 300 * 120) / 900)
    expect(s.maxHeartRateBpm).toBe(150)
    expect(s.distanceM).toBeCloseTo(600 * 10 + 300 * 5)
    expect(s.workKj).toBeCloseTo(150)
    expect(s.normalizedPowerW).toBeGreaterThan(s.avgPowerW)
    expect(s.intensity).toBeCloseTo(s.normalizedPowerW / 200)
  })

  it('handles empty and short rides', () => {
    expect(summarizeInterval([])).toMatchObject({ elapsedS: 0, timerS: 0, avgPowerW: 0 })
    const short = summarizeRide([{ t: 1, powerW: 300 }], 300)
    expect(short).toMatchObject({ intensity: 1, normalizedPowerW: 300 })
  })
})

describe('rideLaps', () => {
  it('splits on segment changes', () => {
    const laps = rideLaps(ride())
    expect(laps.map((l) => [l.segment, l.summary.elapsedS, l.summary.timerS])).toEqual([
      [0, 600, 600],
      [1, 330, 300],
    ])
  })
})

describe('encodeFitActivity', () => {
  it('produces a valid FIT file that decodes back to the same ride', () => {
    const startedAtMs = Date.UTC(2026, 9, 21, 17, 30, 0)
    const bytes = encodeFitActivity({ startedAtMs, utcOffsetMin: 120, samples: ride(), ftpW: 200 })

    const decoder = new Decoder(Stream.fromByteArray(bytes))
    expect(decoder.isFIT()).toBe(true)
    expect(decoder.checkIntegrity()).toBe(true)
    const { messages, errors } = decoder.read()
    expect(errors).toEqual([])

    expect(messages.fileIdMesgs?.[0]).toMatchObject({
      type: 'activity',
      manufacturer: 'development',
    })
    expect(messages.recordMesgs).toHaveLength(900)
    expect(messages.recordMesgs?.[0]).toMatchObject({ power: 200, cadence: 90, heartRate: 150 })
    expect(messages.recordMesgs?.[0]?.timestamp).toEqual(new Date(startedAtMs + 1000))

    const timer = messages.eventMesgs?.map((ev) => ev.eventType)
    expect(timer).toEqual(['start', 'stop', 'start', 'stopAll'])

    expect(messages.lapMesgs).toHaveLength(2)
    expect(messages.lapMesgs?.[0]).toMatchObject({ avgPower: 200, totalTimerTime: 600 })
    expect(messages.lapMesgs?.[1]).toMatchObject({ avgPower: 100, totalElapsedTime: 330 })

    const session = messages.sessionMesgs?.[0]
    expect(session).toMatchObject({
      sport: 'cycling',
      subSport: 'indoorCycling',
      totalTimerTime: 900,
      totalElapsedTime: 930,
      numLaps: 2,
      thresholdPower: 200,
      maxPower: 200,
    })
    expect(session?.startTime).toEqual(new Date(startedAtMs))
    expect(session?.totalDistance).toBeCloseTo(7500, 0)
    expect(messages.activityMesgs?.[0]).toMatchObject({ numSessions: 1, totalTimerTime: 900 })
  })

  it('refuses an empty ride', () => {
    expect(() =>
      encodeFitActivity({ startedAtMs: 0, utcOffsetMin: 0, samples: [], ftpW: 200 }),
    ).toThrow()
  })
})

describe('fitFileName', () => {
  it('uses local time and a safe name', () => {
    const ms = Date.UTC(2026, 9, 21, 17, 5, 0)
    expect(fitFileName(ms, 120, 'Sweet Spot 3×12: hard/easy?')).toBe(
      '2026-10-21_1905_Sweet-Spot-3×12-hardeasy.fit',
    )
  })
})

describe('caloriesKcal', () => {
  it('is about 1 kcal per kJ of work', () => {
    expect(caloriesKcal(1000)).toBeCloseTo(996, 0)
  })
})
