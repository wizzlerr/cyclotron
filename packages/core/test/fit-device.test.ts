import { Decoder, Stream } from '@garmin/fitsdk'
import { describe, expect, it } from 'vitest'
import { asGarminDevice, encodeFitActivity, estimateTrainingEffect, type RideSample } from '../src'

function fit(hr = true): Uint8Array {
  const samples: RideSample[] = []
  for (let t = 1; t <= 900; t++) {
    samples.push({
      t,
      powerW: t % 300 < 30 ? 320 : 180,
      cadenceRpm: 85,
      heartRateBpm: hr ? 145 : undefined,
      speedKmh: 30,
      segment: 0,
    })
  }
  return encodeFitActivity({
    startedAtMs: Date.UTC(2026, 10, 2, 18),
    utcOffsetMin: 60,
    samples,
    ftpW: 200,
  })
}

function decode(bytes: Uint8Array) {
  const d = new Decoder(Stream.fromByteArray(bytes))
  expect(d.checkIntegrity()).toBe(true)
  const { messages, errors } = d.read()
  expect(errors).toEqual([])
  return messages
}

describe('asGarminDevice', () => {
  it('says Garmin Edge 830 with a new file id and adds training effect, keeping the ride', () => {
    const original = fit()
    const { bytes, changed } = asGarminDevice(original, { serialNumber: 1793656000, maxHrBpm: 185 })
    expect(changed).toBe(true)

    const m = decode(bytes)
    expect(m.fileIdMesgs?.[0]).toMatchObject({
      manufacturer: 'garmin',
      product: 3122,
      serialNumber: 1793656000,
    })
    expect(m.deviceInfoMesgs?.[0]).toMatchObject({ manufacturer: 'garmin', product: 3122 })
    const session = m.sessionMesgs?.[0]
    expect(session?.trainingLoadPeak).toBeGreaterThan(0)
    expect(session?.totalTrainingEffect).toBeGreaterThan(0)
    expect(session?.totalAnaerobicTrainingEffect).toBeGreaterThan(0)

    const before = decode(original)
    expect(m.recordMesgs).toEqual(before.recordMesgs)
    expect(m.lapMesgs).toEqual(before.lapMesgs)
    expect(m.eventMesgs).toEqual(before.eventMesgs)
    expect(session).toMatchObject(before.sessionMesgs![0]!)
    expect(before.fileIdMesgs?.[0]).toMatchObject({ manufacturer: 'development' })
  })

  it('leaves files from other makers alone', () => {
    const once = asGarminDevice(fit(), { serialNumber: 1 }).bytes
    const again = asGarminDevice(once, { serialNumber: 2 })
    expect(again.changed).toBe(false)
    expect(again.bytes).toBe(once)
  })

  it('writes no training effect without heart rate', () => {
    const m = decode(asGarminDevice(fit(false), { serialNumber: 1 }).bytes)
    expect(m.sessionMesgs?.[0]?.trainingLoadPeak).toBeUndefined()
  })

  it('rejects files that are not FIT', () => {
    expect(() => asGarminDevice(new Uint8Array(20), { serialNumber: 1 })).toThrow(RangeError)
  })
})

describe('estimateTrainingEffect', () => {
  const steady = (bpm: number, s: number, powerW = 150) =>
    Array.from({ length: s }, () => ({ powerW, heartRateBpm: bpm }))
  const base = { ftpW: 200, maxHrBpm: 185, restingHrBpm: 60 }

  it('is on Garmin-like scales', () => {
    const easy = estimateTrainingEffect({ ...base, samples: steady(130, 3600) })!
    const hard = estimateTrainingEffect({ ...base, samples: steady(170, 3600, 205) })!
    expect(easy.load).toBeGreaterThan(50)
    expect(easy.load).toBeLessThan(110)
    expect(hard.load).toBeGreaterThan(150)
    expect(easy.aerobic).toBeLessThan(hard.aerobic)
    expect(hard.aerobic).toBeLessThanOrEqual(5)
    expect(easy.anaerobic).toBe(0)
  })

  it('needs five minutes of heart rate', () => {
    expect(estimateTrainingEffect({ ...base, samples: steady(140, 200) })).toBeUndefined()
  })
})
