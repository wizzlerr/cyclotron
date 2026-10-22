// Real packets from a Wahoo KICKR CORE 2, firmware 3.5.11, captured with the E1-0 spike.
import { describe, expect, it } from 'vitest'
import {
  GATT,
  fromHex,
  parseControlPointResponse,
  parseFtmsFeatures,
  parseResistanceRange,
  resistanceLevel,
  controlCommand,
  parseIndoorBikeData,
  parsePowerRange,
  shortUuid,
} from '../src'
import capture from './fixtures/kickr-core-2_fw3.5.11_2026-10-21.json'

interface Entry {
  kind: string
  uuid?: string
  hex?: string
}

const log = capture.log as Entry[]
const dv = (hex: string): DataView => {
  const b = fromHex(hex)
  return new DataView(b.buffer, b.byteOffset, b.byteLength)
}
const read = (short: number): DataView =>
  dv(capture.reads.find((r) => shortUuid(r.uuid) === short)!.hex)
const notifications = (short: number): string[] =>
  log.filter((e) => e.kind === 'notify' && shortUuid(e.uuid!) === short).map((e) => e.hex!)

describe('KICKR CORE 2 capture', () => {
  it('advertises ERG, resistance and simulation control', () => {
    const f = parseFtmsFeatures(read(GATT.ftmsFeature))
    expect(f.supportsPowerTarget).toBe(true)
    expect(f.supportsResistanceTarget).toBe(true)
    expect(f.supportsSimulation).toBe(true)
    expect(f.machine).toEqual(['Average Speed', 'Cadence', 'Power Measurement'])
  })

  it('publishes a resistance range of 0–10.0 in 0.1 steps; 0–100 % maps onto it', () => {
    const range = parseResistanceRange(read(GATT.supportedResistanceLevelRange))
    expect(range).toEqual({ min: 0, max: 10, increment: 0.1 })
    expect(resistanceLevel(0, range)).toBe(0)
    expect(resistanceLevel(50, range)).toBe(5)
    expect(resistanceLevel(100, range)).toBe(10)
    expect(resistanceLevel(33, range)).toBe(3.3)
    // The command byte stays within the trainer's max (10.0 → 100).
    expect([...controlCommand({ kind: 'resistance', level: 100 }, range).bytes]).toEqual([
      0x04, 100,
    ])
  })

  it("doesn't offer spin-down calibration over FTMS", () => {
    expect(parseFtmsFeatures(read(GATT.ftmsFeature)).supportsSpinDown).toBe(false)
  })

  it('supports 0–2000 W in 1 W steps', () => {
    expect(parsePowerRange(read(GATT.supportedPowerRange))).toEqual({
      minW: 0,
      maxW: 2000,
      incrementW: 1,
    })
  })

  it('sends speed, cadence and power in every Indoor Bike Data packet', () => {
    const packets = notifications(GATT.indoorBikeData)
    expect(packets.length).toBeGreaterThan(100)
    for (const hex of packets) {
      const d = parseIndoorBikeData(dv(hex))
      expect(Object.keys(d).sort()).toEqual(['cadenceRpm', 'powerW', 'speedKmh'])
    }
    expect(parseIndoorBikeData(dv('44 00 dc 04 5c 00 87 00'))).toEqual({
      speedKmh: 12.44,
      cadenceRpm: 46,
      powerW: 135,
    })
  })

  it('acknowledges Request Control, Start and Set Target Power', () => {
    const responses = notifications(GATT.ftmsControlPoint).map((h) =>
      parseControlPointResponse(dv(h)),
    )
    expect(responses.map((r) => [r?.requestOp, r?.ok])).toEqual([
      [0x00, true],
      [0x07, true],
      [0x05, true],
    ])
  })
})
