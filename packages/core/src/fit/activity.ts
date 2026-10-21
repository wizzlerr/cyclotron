// FIT activity export (E5-2, DESIGN.md §4.5) with Garmin's official SDK. Pure: the caller passes
// the start time and UTC offset.

import {
  Encoder,
  Profile,
  type ActivityMesg,
  type DeviceInfoMesg,
  type EventMesg,
  type FileIdMesg,
  type LapMesg,
  type Mesg,
  type RecordMesg,
  type SessionMesg,
} from '@garmin/fitsdk'
import { caloriesKcal } from '../metrics/power'
import { rideLaps, summarizeRide, type IntervalSummary, type RideSample } from '../ride/summary'

export interface FitActivityInput {
  /** Ride start, ms since the Unix epoch. */
  startedAtMs: number
  /** Local time minus UTC, in minutes (e.g. 120 for CEST). */
  utcOffsetMin: number
  samples: readonly RideSample[]
  ftpW: number
  softwareVersion?: number
}

const PRODUCT_NAME = 'Cyclotron'
const FORBIDDEN_FILE_CHARS = '<>:"/\\|?*'

// FIT time counts seconds from 1989-12-31T00:00:00Z.
const FIT_EPOCH_S = 631065600

/** Message numbers (the SDK types MesgNum as a plain record, so look them up once). */
const MESG = {
  fileId: mesgNum('FILE_ID'),
  deviceInfo: mesgNum('DEVICE_INFO'),
  event: mesgNum('EVENT'),
  record: mesgNum('RECORD'),
  lap: mesgNum('LAP'),
  session: mesgNum('SESSION'),
  activity: mesgNum('ACTIVITY'),
}

/** `onMesg` takes the base `Mesg` type; the type argument checks fields per message. */
function write<T extends Mesg>(e: Encoder, num: number, mesg: T): void {
  e.onMesg(num, mesg)
}

function mesgNum(name: string): number {
  const n = Profile.MesgNum[name]
  if (n === undefined) throw new Error(`FIT profile has no ${name} message`)
  return n
}

/** Encodes a ride as a FIT activity: records, timer events for pauses, one lap per step. */
export function encodeFitActivity(input: FitActivityInput): Uint8Array {
  const { startedAtMs, samples } = input
  if (samples.length === 0) throw new RangeError('no samples to encode')
  // A sample at t covers (t-1, t]: its record carries the timestamp of the end of that second.
  const at = (t: number): Date => new Date(startedAtMs + t * 1000)
  const start = at(samples[0]!.t - 1)
  const end = at(samples.at(-1)!.t)
  const ride = summarizeRide(samples, input.ftpW)
  const laps = rideLaps(samples)

  const e = new Encoder()
  write<FileIdMesg>(e, MESG.fileId, {
    type: 'activity',
    manufacturer: 'development',
    product: 0,
    productName: PRODUCT_NAME,
    timeCreated: start,
    serialNumber: 1,
  })
  write<DeviceInfoMesg>(e, MESG.deviceInfo, {
    timestamp: start,
    deviceIndex: 'creator',
    manufacturer: 'development',
    product: 0,
    productName: PRODUCT_NAME,
    softwareVersion: input.softwareVersion ?? 0,
  })
  write<EventMesg>(e, MESG.event, {
    timestamp: start,
    event: 'timer',
    eventType: 'start',
  })

  let distanceM = 0
  let paused = false
  for (const s of samples) {
    if ((s.paused ?? false) !== paused) {
      paused = !paused
      write<EventMesg>(e, MESG.event, {
        timestamp: at(s.t - 1),
        event: 'timer',
        eventType: paused ? 'stop' : 'start',
      })
    }
    if (paused) continue
    distanceM += (s.speedKmh ?? 0) / 3.6
    write<RecordMesg>(e, MESG.record, {
      timestamp: at(s.t),
      power: round(s.powerW),
      cadence: round(s.cadenceRpm),
      heartRate: s.heartRateBpm ? Math.round(s.heartRateBpm) : undefined,
      speed: (s.speedKmh ?? 0) / 3.6,
      distance: distanceM,
    })
  }

  write<EventMesg>(e, MESG.event, {
    timestamp: end,
    event: 'timer',
    eventType: 'stopAll',
  })

  laps.forEach((lap, i) => {
    write<LapMesg>(e, MESG.lap, {
      messageIndex: i,
      timestamp: at(lap.summary.lastT),
      startTime: at(lap.summary.firstT - 1),
      event: 'lap',
      eventType: 'stop',
      lapTrigger: i === laps.length - 1 ? 'sessionEnd' : 'manual',
      sport: 'cycling',
      ...totals(lap.summary),
    })
  })

  write<SessionMesg>(e, MESG.session, {
    messageIndex: 0,
    timestamp: end,
    startTime: start,
    event: 'session',
    eventType: 'stop',
    trigger: 'activityEnd',
    sport: 'cycling',
    subSport: 'indoorCycling',
    firstLapIndex: 0,
    numLaps: laps.length,
    thresholdPower: Math.round(input.ftpW),
    trainingStressScore: ride.tss,
    intensityFactor: ride.intensity,
    ...totals(ride),
  })

  write<ActivityMesg>(e, MESG.activity, {
    timestamp: end,
    // Local time as FIT seconds (the SDK only converts UTC `Date`s).
    localTimestamp: Math.round(end.getTime() / 1000) - FIT_EPOCH_S + input.utcOffsetMin * 60,
    totalTimerTime: ride.timerS,
    numSessions: 1,
    type: 'manual',
    event: 'activity',
    eventType: 'stop',
  })

  return e.close()
}

function totals(s: IntervalSummary) {
  return {
    totalElapsedTime: s.elapsedS,
    totalTimerTime: s.timerS,
    totalDistance: s.distanceM,
    totalWork: Math.round(s.workKj * 1000),
    totalCalories: Math.round(caloriesKcal(s.workKj)),
    avgPower: Math.round(s.avgPowerW),
    maxPower: Math.round(s.maxPowerW),
    normalizedPower: Math.round(s.normalizedPowerW),
    avgCadence: round(s.avgCadenceRpm),
    maxCadence: round(s.maxCadenceRpm),
    avgHeartRate: round(s.avgHeartRateBpm),
    maxHeartRate: round(s.maxHeartRateBpm),
    avgSpeed: s.avgSpeedKmh / 3.6,
    maxSpeed: s.maxSpeedKmh / 3.6,
  }
}

const round = (n: number | undefined): number | undefined =>
  n === undefined ? undefined : Math.round(n)

/** `YYYY-MM-DD_HHmm_<name>.fit` in local time, safe on Windows and macOS. */
export function fitFileName(startedAtMs: number, utcOffsetMin: number, name: string): string {
  const local = new Date(startedAtMs + utcOffsetMin * 60_000).toISOString()
  const stamp = `${local.slice(0, 10)}_${local.slice(11, 13)}${local.slice(14, 16)}`
  const safe = [...name]
    .filter((c) => c.charCodeAt(0) >= 0x20 && !FORBIDDEN_FILE_CHARS.includes(c))
    .join('')
    .replace(/\s+/g, '-')
    .slice(0, 60)
  return `${stamp}_${safe || 'ride'}.fit`
}
