// FIT activity import (E9-5): any cycling FIT file (ours, Garmin, Wahoo, Zwift…) back into the
// same 1 Hz samples a recorded ride has. Pure: bytes in, data out.

import { Decoder, Stream } from '@garmin/fitsdk'
import type { RideSample } from '../ride/summary'

export interface DecodedActivity {
  /** First record's second, ms since the Unix epoch (UTC). */
  startedAtMs: number
  /** Local time minus UTC, minutes, when the file says (activity local_timestamp). */
  utcOffsetMin?: number
  sport?: string
  subSport?: string
  /** FTP the recording device knew (session threshold_power), if any. */
  ftpW?: number
  /** One sample per recorded second, `t` counted from the first record (gaps are skipped). */
  samples: RideSample[]
}

/** `code` lets the UI word the error in its own language (DESIGN.md D21). */
export class FitImportError extends Error {
  constructor(
    readonly code: 'notFit' | 'noRecords',
    message: string,
  ) {
    super(message)
  }
}

// FIT time counts seconds from 1989-12-31T00:00:00Z.
const FIT_EPOCH_S = 631065600
const SEMICIRCLE_TO_DEG = 180 / 2 ** 31

export function decodeFitActivity(bytes: Uint8Array): DecodedActivity {
  const decoder = new Decoder(Stream.fromByteArray(bytes))
  if (!decoder.isFIT()) throw new FitImportError('notFit', 'not a FIT file')
  const { messages, errors } = decoder.read()
  const records = (messages.recordMesgs ?? []).filter((r) => r.timestamp instanceof Date)
  if (records.length === 0) {
    throw new FitImportError(
      'noRecords',
      errors.length > 0 ? String(errors[0]) : 'no data records in the file',
    )
  }

  const startedAtMs = (records[0]!.timestamp as Date).getTime() - 1000
  const samples: RideSample[] = []
  for (const r of records) {
    const t = Math.round(((r.timestamp as Date).getTime() - startedAtMs) / 1000)
    // Devices sometimes write two records for one second; keep the first.
    if (samples.length > 0 && t <= samples.at(-1)!.t) continue
    const speed = num(r.enhancedSpeed) ?? num(r.speed)
    const altitude = num(r.enhancedAltitude) ?? num(r.altitude)
    const lat = num(r.positionLat)
    const lon = num(r.positionLong)
    samples.push({
      t,
      powerW: num(r.power),
      cadenceRpm: num(r.cadence),
      heartRateBpm: num(r.heartRate),
      speedKmh: speed === undefined ? undefined : speed * 3.6,
      distanceM: num(r.distance),
      altitudeM: altitude,
      lat: lat === undefined ? undefined : lat * SEMICIRCLE_TO_DEG,
      lon: lon === undefined ? undefined : lon * SEMICIRCLE_TO_DEG,
    })
  }

  const session = messages.sessionMesgs?.[0]
  const activity = messages.activityMesgs?.[0]
  let utcOffsetMin: number | undefined
  if (activity?.timestamp instanceof Date && typeof activity.localTimestamp === 'number') {
    const utcS = activity.timestamp.getTime() / 1000 - FIT_EPOCH_S
    // Whole quarter hours: time zones are never finer.
    utcOffsetMin = Math.round((activity.localTimestamp - utcS) / 60 / 15) * 15
  }
  return {
    startedAtMs,
    utcOffsetMin,
    sport: str(session?.sport),
    subSport: str(session?.subSport),
    ftpW: num(session?.thresholdPower),
    samples,
  }
}

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
