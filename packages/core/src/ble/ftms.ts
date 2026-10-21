// Fitness Machine Service (FTMS) v1.0: pure byte parsers and encoders. All values little-endian.

const has = (flags: number, bit: number): boolean => (flags & (1 << bit)) !== 0

const flagNames = (flags: number, names: readonly string[]): string[] =>
  names.filter((_, bit) => has(flags, bit))

const MACHINE_FEATURES = [
  'Average Speed',
  'Cadence',
  'Total Distance',
  'Inclination',
  'Elevation Gain',
  'Pace',
  'Step Count',
  'Resistance Level',
  'Stride Count',
  'Expended Energy',
  'Heart Rate Measurement',
  'Metabolic Equivalent',
  'Elapsed Time',
  'Remaining Time',
  'Power Measurement',
  'Force on Belt and Power Output',
  'User Data Retention',
] as const

const TARGET_FEATURES = [
  'Speed Target',
  'Inclination Target',
  'Resistance Target',
  'Power Target',
  'Heart Rate Target',
  'Targeted Expended Energy',
  'Targeted Step Number',
  'Targeted Stride Number',
  'Targeted Distance',
  'Targeted Training Time',
  'Targeted Time in Two HR Zones',
  'Targeted Time in Three HR Zones',
  'Targeted Time in Five HR Zones',
  'Indoor Bike Simulation',
  'Wheel Circumference',
  'Spin Down Control',
  'Targeted Cadence',
] as const

export interface FtmsFeatures {
  machine: string[]
  targets: string[]
  supportsPowerTarget: boolean
  supportsResistanceTarget: boolean
  supportsSimulation: boolean
  supportsSpinDown: boolean
}

/** Fitness Machine Feature (0x2ACC): uint32 machine features + uint32 target setting features. */
export function parseFtmsFeatures(dv: DataView): FtmsFeatures {
  const machine = dv.getUint32(0, true)
  const targets = dv.getUint32(4, true)
  return {
    machine: flagNames(machine, MACHINE_FEATURES),
    targets: flagNames(targets, TARGET_FEATURES),
    supportsPowerTarget: has(targets, 3),
    supportsResistanceTarget: has(targets, 2),
    supportsSimulation: has(targets, 13),
    supportsSpinDown: has(targets, 15),
  }
}

export interface PowerRange {
  minW: number
  maxW: number
  incrementW: number
}

/** Supported Power Range (0x2AD8). */
export function parsePowerRange(dv: DataView): PowerRange {
  return {
    minW: dv.getInt16(0, true),
    maxW: dv.getInt16(2, true),
    incrementW: dv.getUint16(4, true),
  }
}

export interface IndoorBikeData {
  speedKmh?: number
  avgSpeedKmh?: number
  cadenceRpm?: number
  avgCadenceRpm?: number
  totalDistanceM?: number
  resistanceLevel?: number
  powerW?: number
  avgPowerW?: number
  totalEnergyKcal?: number
  energyPerHourKcal?: number
  energyPerMinuteKcal?: number
  heartRateBpm?: number
  metabolicEquivalent?: number
  elapsedTimeS?: number
  remainingTimeS?: number
}

/**
 * Indoor Bike Data (0x2AD2). Fields appear in flag-bit order. Bit 0 ("More Data") is inverted:
 * when it is 0, Instantaneous Speed is present.
 */
export function parseIndoorBikeData(dv: DataView): IndoorBikeData {
  const flags = dv.getUint16(0, true)
  const r: IndoorBikeData = {}
  let o = 2
  const u8 = (): number => dv.getUint8(o++)
  const u16 = (): number => {
    const v = dv.getUint16(o, true)
    o += 2
    return v
  }
  const s16 = (): number => {
    const v = dv.getInt16(o, true)
    o += 2
    return v
  }

  if (!has(flags, 0)) r.speedKmh = u16() / 100
  if (has(flags, 1)) r.avgSpeedKmh = u16() / 100
  if (has(flags, 2)) r.cadenceRpm = u16() / 2
  if (has(flags, 3)) r.avgCadenceRpm = u16() / 2
  if (has(flags, 4)) r.totalDistanceM = u16() | (u8() << 16)
  if (has(flags, 5)) r.resistanceLevel = s16()
  if (has(flags, 6)) r.powerW = s16()
  if (has(flags, 7)) r.avgPowerW = s16()
  if (has(flags, 8)) {
    r.totalEnergyKcal = u16()
    r.energyPerHourKcal = u16()
    r.energyPerMinuteKcal = u8()
  }
  if (has(flags, 9)) r.heartRateBpm = u8()
  if (has(flags, 10)) r.metabolicEquivalent = u8() / 10
  if (has(flags, 11)) r.elapsedTimeS = u16()
  if (has(flags, 12)) r.remainingTimeS = u16()
  return r
}

// --- Control Point (0x2AD9) ---

export const FtmsOp = {
  requestControl: 0x00,
  reset: 0x01,
  setTargetResistance: 0x04,
  setTargetPower: 0x05,
  startOrResume: 0x07,
  stopOrPause: 0x08,
  setIndoorBikeSimulation: 0x11,
  responseCode: 0x80,
} as const

export const encodeRequestControl = (): Uint8Array => Uint8Array.of(FtmsOp.requestControl)
export const encodeReset = (): Uint8Array => Uint8Array.of(FtmsOp.reset)
export const encodeStartOrResume = (): Uint8Array => Uint8Array.of(FtmsOp.startOrResume)
export const encodeStop = (): Uint8Array => Uint8Array.of(FtmsOp.stopOrPause, 0x01)
export const encodePause = (): Uint8Array => Uint8Array.of(FtmsOp.stopOrPause, 0x02)

/** ERG: target power in watts (sint16). */
export function encodeSetTargetPower(watts: number): Uint8Array {
  const out = new Uint8Array(3)
  const dv = new DataView(out.buffer)
  dv.setUint8(0, FtmsOp.setTargetPower)
  dv.setInt16(1, clamp(Math.round(watts), -32768, 32767), true)
  return out
}

/** Resistance level, unitless, 0.1 resolution (uint8 per FTMS v1.0). */
export function encodeSetTargetResistance(level: number): Uint8Array {
  return Uint8Array.of(FtmsOp.setTargetResistance, clamp(Math.round(level * 10), 0, 255))
}

export interface SimulationParams {
  /** Grade in percent, e.g. 5.5 for 5.5 %. */
  gradePct: number
  windSpeedMps?: number
  /** Rolling resistance coefficient. */
  crr?: number
  /** Wind resistance coefficient in kg/m. */
  cw?: number
}

export function encodeSetIndoorBikeSimulation(p: SimulationParams): Uint8Array {
  const out = new Uint8Array(7)
  const dv = new DataView(out.buffer)
  dv.setUint8(0, FtmsOp.setIndoorBikeSimulation)
  dv.setInt16(1, clamp(Math.round((p.windSpeedMps ?? 0) * 1000), -32768, 32767), true)
  dv.setInt16(3, clamp(Math.round(p.gradePct * 100), -32768, 32767), true)
  dv.setUint8(5, clamp(Math.round((p.crr ?? 0.004) * 10000), 0, 255))
  dv.setUint8(6, clamp(Math.round((p.cw ?? 0.51) * 100), 0, 255))
  return out
}

const RESULT_CODES: Record<number, string> = {
  0x01: 'success',
  0x02: 'op code not supported',
  0x03: 'invalid parameter',
  0x04: 'operation failed',
  0x05: 'control not permitted',
}

export interface ControlPointResponse {
  requestOp: number
  resultCode: number
  result: string
  ok: boolean
}

/** Parses a Control Point indication; returns undefined if it isn't a response (0x80). */
export function parseControlPointResponse(dv: DataView): ControlPointResponse | undefined {
  if (dv.byteLength < 3 || dv.getUint8(0) !== FtmsOp.responseCode) return undefined
  const resultCode = dv.getUint8(2)
  return {
    requestOp: dv.getUint8(1),
    resultCode,
    result: RESULT_CODES[resultCode] ?? `unknown (0x${resultCode.toString(16)})`,
    ok: resultCode === 0x01,
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
