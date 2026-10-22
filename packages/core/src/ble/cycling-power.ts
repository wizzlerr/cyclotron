// Cycling Power Measurement (0x2A63), Bluetooth Cycling Power Service v1.1 (E1-3): the fallback for
// trainers and power meters without FTMS. Read-only: power, plus crank and wheel revolution
// counters from which cadence and speed are derived.

export interface CyclingPowerMeasurement {
  powerW: number
  /** Cumulative wheel revolutions and the last wheel event time (1/2048 s), if present. */
  wheel?: { revs: number; time: number }
  /** Cumulative crank revolutions and the last crank event time (1/1024 s), if present. */
  crank?: { revs: number; time: number }
}

export function parseCyclingPowerMeasurement(dv: DataView): CyclingPowerMeasurement {
  const flags = dv.getUint16(0, true)
  const r: CyclingPowerMeasurement = { powerW: dv.getInt16(2, true) }
  let o = 4
  if (flags & 0x0001) o += 1 // pedal power balance
  if (flags & 0x0004) o += 2 // accumulated torque
  if (flags & 0x0010) {
    r.wheel = { revs: dv.getUint32(o, true), time: dv.getUint16(o + 4, true) }
    o += 6
  }
  // Later fields (extreme forces, angles, energy) aren't needed.
  if (flags & 0x0020) r.crank = { revs: dv.getUint16(o, true), time: dv.getUint16(o + 2, true) }
  return r
}

/**
 * Revolutions per minute from cumulative counters, as BLE sensors send them: a revolution count
 * and the time of the last revolution, both wrapping. Returns 0 when no revolution has happened
 * for `idleMs` (the counters simply stop changing when you stop pedalling).
 */
export class RevolutionRate {
  private last: { revs: number; time: number; at: number } | undefined
  private rpm = 0

  constructor(
    /** Event time ticks per second (1024 for cranks, 2048 for wheels). */
    private ticksPerS: number,
    /** Counter wrap (65 536 for crank revs, 2³² for wheel revs). */
    private revWrap: number,
    private idleMs = 3000,
  ) {}

  /** `nowMs` is the time the notification arrived. */
  update(revs: number, time: number, nowMs: number): number {
    const prev = this.last
    if (!prev) {
      this.last = { revs, time, at: nowMs }
      return 0
    }
    const dRevs = (revs - prev.revs + this.revWrap) % this.revWrap
    const dTicks = (time - prev.time + 65_536) % 65_536
    if (dRevs > 0 && dTicks > 0) {
      this.rpm = (dRevs / (dTicks / this.ticksPerS)) * 60
      this.last = { revs, time, at: nowMs }
    } else if (nowMs - prev.at > this.idleMs) {
      this.rpm = 0
    }
    return this.rpm
  }
}

/** Typical 700×25c wheel, for speed from a wheel revolution rate. */
export const DEFAULT_WHEEL_CIRCUMFERENCE_M = 2.105

export const wheelRpmToKmh = (
  rpm: number,
  circumferenceM = DEFAULT_WHEEL_CIRCUMFERENCE_M,
): number => (rpm * circumferenceM * 60) / 1000
