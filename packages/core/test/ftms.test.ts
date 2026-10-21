import { describe, expect, it } from 'vitest'
import {
  encodeRequestControl,
  encodeSetIndoorBikeSimulation,
  encodeSetTargetPower,
  encodeSetTargetResistance,
  encodeStop,
  fromHex,
  parseControlPointResponse,
  parseFtmsFeatures,
  parseIndoorBikeData,
  parsePowerRange,
  toHex,
} from '../src'

const dv = (hex: string): DataView => {
  const b = fromHex(hex)
  return new DataView(b.buffer, b.byteOffset, b.byteLength)
}

describe('parseIndoorBikeData', () => {
  it('reads speed, cadence and power', () => {
    // flags 0x0044: cadence (bit 2) + power (bit 6); bit 0 clear → speed present
    expect(parseIndoorBikeData(dv('44 00 e8 03 b4 00 fa 00'))).toEqual({
      speedKmh: 10,
      cadenceRpm: 90,
      powerW: 250,
    })
  })

  it('skips speed when More Data is set and reads later fields in order', () => {
    // flags 0x0261: more data, resistance (5), power (6), heart rate (9)
    expect(parseIndoorBikeData(dv('61 02 0a 00 38 ff 8c'))).toEqual({
      resistanceLevel: 10,
      powerW: -200,
      heartRateBpm: 140,
    })
  })

  it('reads 24-bit distance and the 5-byte energy block', () => {
    // flags 0x0111: more data, distance (4), energy (8)
    expect(parseIndoorBikeData(dv('11 01 40 e2 01 64 00 58 02 0a'))).toEqual({
      totalDistanceM: 123456,
      totalEnergyKcal: 100,
      energyPerHourKcal: 600,
      energyPerMinuteKcal: 10,
    })
  })
})

describe('parseFtmsFeatures', () => {
  it('decodes machine and target bits', () => {
    // machine: cadence (1) + power (14) = 0x4002; targets: resistance (2) + power (3) + simulation (13) = 0x200c
    const f = parseFtmsFeatures(dv('02 40 00 00 0c 20 00 00'))
    expect(f.machine).toEqual(['Cadence', 'Power Measurement'])
    expect(f.targets).toEqual(['Resistance Target', 'Power Target', 'Indoor Bike Simulation'])
    expect(f.supportsPowerTarget).toBe(true)
    expect(f.supportsSimulation).toBe(true)
    expect(f.supportsSpinDown).toBe(false)
  })
})

describe('parsePowerRange', () => {
  it('reads min, max and increment', () => {
    expect(parsePowerRange(dv('00 00 d0 07 01 00'))).toEqual({ minW: 0, maxW: 2000, incrementW: 1 })
  })
})

describe('control point encoders', () => {
  it('encodes commands', () => {
    expect(toHex(encodeRequestControl())).toBe('00')
    expect(toHex(encodeStop())).toBe('08 01')
    expect(toHex(encodeSetTargetPower(250))).toBe('05 fa 00')
    expect(toHex(encodeSetTargetPower(-1))).toBe('05 ff ff')
    expect(toHex(encodeSetTargetResistance(5.5))).toBe('04 37')
  })

  it('encodes simulation with default crr and cw', () => {
    // wind 0, grade 5.5 % → 550 = 0x0226, crr 0.004 → 40, cw 0.51 → 51
    expect(toHex(encodeSetIndoorBikeSimulation({ gradePct: 5.5 }))).toBe('11 00 00 26 02 28 33')
    expect(toHex(encodeSetIndoorBikeSimulation({ gradePct: -2 }))).toBe('11 00 00 38 ff 28 33')
  })
})

describe('parseControlPointResponse', () => {
  it('parses responses', () => {
    expect(parseControlPointResponse(dv('80 05 01'))).toEqual({
      requestOp: 5,
      resultCode: 1,
      result: 'success',
      ok: true,
    })
    expect(parseControlPointResponse(dv('80 00 05'))?.result).toBe('control not permitted')
  })

  it('ignores non-responses', () => {
    expect(parseControlPointResponse(dv('05 fa 00'))).toBeUndefined()
  })
})

describe('hex helpers', () => {
  it('round-trips', () => {
    expect(toHex(fromHex('00 7f ff'))).toBe('00 7f ff')
    expect(() => fromHex('zz')).toThrow(RangeError)
  })
})
