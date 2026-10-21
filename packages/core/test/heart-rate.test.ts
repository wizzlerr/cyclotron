import { describe, expect, it } from 'vitest'
import { fromHex, parseHeartRateMeasurement } from '../src'

const dv = (hex: string): DataView => {
  const b = fromHex(hex)
  return new DataView(b.buffer, b.byteOffset, b.byteLength)
}

describe('parseHeartRateMeasurement', () => {
  it('reads a uint8 heart rate', () => {
    expect(parseHeartRateMeasurement(dv('00 48'))).toEqual({ bpm: 72, rrMs: [] })
  })

  it('reads a uint16 heart rate', () => {
    expect(parseHeartRateMeasurement(dv('01 2c 01')).bpm).toBe(300)
  })

  it('reads contact, energy and RR intervals', () => {
    // flags 0x1e: contact supported + detected, energy present, RR present (Polar H10 style)
    expect(parseHeartRateMeasurement(dv('1e 8c 10 00 00 04 cd 03'))).toEqual({
      bpm: 140,
      contact: true,
      energyKj: 16,
      rrMs: [1000, 950],
    })
  })

  it('reports lost skin contact', () => {
    expect(parseHeartRateMeasurement(dv('04 00')).contact).toBe(false)
  })
})
