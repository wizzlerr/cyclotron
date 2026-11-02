// The copy of a ride sent to Garmin Connect (D33). Connect only gives training load to files from
// Garmin devices or partner apps, and only when the session carries training-effect fields (an
// Edge writes them during the ride); it then works out its own load from the heart rate. So the
// copy says "Garmin Edge 830", gets a file id of its own (Connect refuses a file id it has seen,
// so every send is new) and gets estimated load and training effect when the file has none.

import { Decoder, Encoder, Profile, Stream, type Mesg as FitMesg } from '@garmin/fitsdk'
import { estimateTrainingEffect } from '../metrics/training-effect'

/** Garmin product id of the Edge 830 bike computer. */
export const EDGE_830 = 3122
/** Used when the profile has no max HR; resting HR isn't stored at all. */
const DEFAULT_MAX_HR = 185
const DEFAULT_RESTING_HR = 60

const FILE_ID = Profile.MesgNum.FILE_ID!
const DEVICE_INFO = Profile.MesgNum.DEVICE_INFO!
const SESSION = Profile.MesgNum.SESSION!
const RECORD = Profile.MesgNum.RECORD!

export interface GarminCopyOptions {
  /** New file id serial, different on every send (e.g. from the send time). */
  serialNumber: number
  maxHrBpm?: number
  restingHrBpm?: number
}

/** A decoded message with its fields by name. */
type Mesg = FitMesg & Record<string, unknown>

/**
 * Returns the Garmin copy of a FIT file written by this app. Files from any other maker come
 * back unchanged (`changed: false`). Throws a RangeError for a file that isn't valid FIT.
 */
export function asGarminDevice(
  bytes: Uint8Array,
  options: GarminCopyOptions,
): { bytes: Uint8Array; changed: boolean } {
  const decoder = new Decoder(Stream.fromByteArray(bytes))
  if (!decoder.isFIT() || !decoder.checkIntegrity()) throw new RangeError('not a valid FIT file')
  const list: [number, Mesg][] = []
  const { errors } = decoder.read({
    mesgListener: (num: number, mesg: FitMesg) => {
      list.push([num, mesg as Mesg])
    },
  })
  if (errors.length > 0) throw new RangeError(`FIT file can't be read: ${String(errors[0])}`)
  const fileId = list.find(([num]) => num === FILE_ID)?.[1]
  if (fileId?.manufacturer !== 'development') return { bytes, changed: false }

  const records = list.filter(([num]) => num === RECORD).map(([, m]) => m)
  const encoder = new Encoder()
  for (const [num, mesg] of list) {
    if (num === FILE_ID) {
      Object.assign(mesg, {
        manufacturer: 'garmin',
        product: EDGE_830,
        serialNumber: options.serialNumber >>> 0,
      })
    } else if (num === DEVICE_INFO && mesg.manufacturer === 'development') {
      Object.assign(mesg, { manufacturer: 'garmin', product: EDGE_830 })
    } else if (num === SESSION && mesg.trainingLoadPeak === undefined) {
      Object.assign(mesg, effectFields(mesg, records, options))
    }
    // The decoder adds these for Garmin products; they're the same field as `product`.
    delete mesg.garminProduct
    encoder.onMesg(num, mesg)
  }
  return { bytes: encoder.close(), changed: true }
}

function effectFields(session: Mesg, records: Mesg[], options: GarminCopyOptions): Mesg {
  const ftpW = typeof session.thresholdPower === 'number' ? session.thresholdPower : 0
  const effect = estimateTrainingEffect({
    samples: records.map((r) => ({
      powerW: typeof r.power === 'number' ? r.power : 0,
      heartRateBpm: typeof r.heartRate === 'number' ? r.heartRate : undefined,
    })),
    ftpW,
    maxHrBpm: options.maxHrBpm ?? DEFAULT_MAX_HR,
    restingHrBpm: options.restingHrBpm ?? DEFAULT_RESTING_HR,
  })
  if (!effect) return {}
  return {
    trainingLoadPeak: effect.load,
    totalTrainingEffect: effect.aerobic,
    totalAnaerobicTrainingEffect: effect.anaerobic,
  }
}
