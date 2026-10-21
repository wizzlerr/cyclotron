// Heart Rate Measurement (0x2A37), Bluetooth Heart Rate Service v1.0.

export interface HeartRateMeasurement {
  bpm: number
  /** Undefined when the sensor doesn't report skin contact. */
  contact?: boolean
  energyKj?: number
  /** RR intervals in milliseconds (sent in 1/1024 s). */
  rrMs: number[]
}

export function parseHeartRateMeasurement(dv: DataView): HeartRateMeasurement {
  const flags = dv.getUint8(0)
  let o = 1
  const bpm = flags & 0x01 ? dv.getUint16(o, true) : dv.getUint8(o)
  o += flags & 0x01 ? 2 : 1

  const r: HeartRateMeasurement = { bpm, rrMs: [] }
  if (flags & 0x04) r.contact = (flags & 0x02) !== 0
  if (flags & 0x08) {
    r.energyKj = dv.getUint16(o, true)
    o += 2
  }
  if (flags & 0x10) {
    for (; o + 1 < dv.byteLength; o += 2) {
      r.rrMs.push(Math.round((dv.getUint16(o, true) * 1000) / 1024))
    }
  }
  return r
}
