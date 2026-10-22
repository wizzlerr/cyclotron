import { describe, expect, it } from 'vitest'
import { parseCyclingPowerMeasurement, RevolutionRate, wheelRpmToKmh } from '../src'

const dv = (bytes: number[]): DataView => new DataView(Uint8Array.from(bytes).buffer)

describe('parseCyclingPowerMeasurement', () => {
  it('reads power alone', () => {
    expect(parseCyclingPowerMeasurement(dv([0x00, 0x00, 0xfa, 0x00]))).toEqual({ powerW: 250 })
  })

  it('reads wheel and crank data after the optional fields before them', () => {
    // Flags: pedal balance (0x01) + wheel (0x10) + crank (0x20).
    const m = parseCyclingPowerMeasurement(
      dv([
        0x31,
        0x00, // flags
        0x2c,
        0x01, // 300 W
        0x64, // pedal balance (skipped)
        0x10,
        0x27,
        0x00,
        0x00, // 10 000 wheel revs
        0x00,
        0x08, // wheel time 2048
        0x64,
        0x00, // 100 crank revs
        0x00,
        0x04, // crank time 1024
      ]),
    )
    expect(m).toEqual({
      powerW: 300,
      wheel: { revs: 10_000, time: 2048 },
      crank: { revs: 100, time: 1024 },
    })
  })
})

describe('RevolutionRate', () => {
  it('turns counters into rpm, across counter wraps', () => {
    const r = new RevolutionRate(1024, 65_536)
    expect(r.update(100, 1024, 0)).toBe(0)
    // 1.5 revolutions in 1 s → 90 rpm.
    expect(r.update(101, 1024 + 683, 667)).toBeCloseTo(90, 0)
    // Counters wrap: 65 535 → 1 is 2 revolutions; time wraps too.
    const w = new RevolutionRate(1024, 65_536)
    w.update(65_535, 65_000, 0)
    expect(w.update(1, (65_000 + 1365) % 65_536, 1333)).toBeCloseTo(90, 0)
  })

  it('drops to 0 when pedalling stops', () => {
    const r = new RevolutionRate(1024, 65_536, 3000)
    r.update(10, 0, 0)
    expect(r.update(11, 683, 700)).toBeGreaterThan(80)
    expect(r.update(11, 683, 2000)).toBeGreaterThan(80) // same event repeated: keep
    expect(r.update(11, 683, 4000)).toBe(0)
  })

  it('converts wheel rpm to speed', () => {
    expect(wheelRpmToKmh(250)).toBeCloseTo(31.6, 1)
  })
})
