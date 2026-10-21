import { describe, expect, it } from 'vitest'
import { decodeFitActivity, encodeFitActivity, FitImportError, type RideSample } from '../src'

describe('decodeFitActivity', () => {
  it('reads back what encodeFitActivity wrote, pauses as gaps', () => {
    const samples: RideSample[] = []
    for (let t = 1; t <= 120; t++) {
      samples.push({
        t,
        powerW: 200 + (t % 7),
        cadenceRpm: 90,
        heartRateBpm: 140,
        speedKmh: 30,
        paused: t > 60 && t <= 70,
        lat: 45 + t * 1e-5,
        lon: 6,
        altitudeM: 100 + t * 0.1,
        distanceM: t * 8.3,
      })
    }
    const startedAtMs = Date.UTC(2026, 9, 21, 17, 0, 0)
    const bytes = encodeFitActivity({ startedAtMs, utcOffsetMin: 120, samples, ftpW: 250 })

    const a = decodeFitActivity(bytes)
    expect(a.startedAtMs).toBe(startedAtMs)
    expect(a.utcOffsetMin).toBe(120)
    expect(a.sport).toBe('cycling')
    expect(a.subSport).toBe('virtualActivity')
    expect(a.ftpW).toBe(250)
    // The 10 paused seconds have no records.
    expect(a.samples).toHaveLength(110)
    expect(a.samples[0]).toMatchObject({ t: 1, powerW: 201, cadenceRpm: 90, heartRateBpm: 140 })
    expect(a.samples[0]!.speedKmh).toBeCloseTo(30, 1)
    expect(a.samples[0]!.lat).toBeCloseTo(45.00001, 5)
    expect(a.samples[60]!.t).toBe(71)
    expect(a.samples.at(-1)!.distanceM).toBeCloseTo(996, 0)
  })

  it('rejects files that are not FIT', () => {
    expect(() => decodeFitActivity(Uint8Array.from([104, 101, 108, 108, 111]))).toThrow(
      FitImportError,
    )
  })
})
