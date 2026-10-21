import {
  analyzeFtpTest,
  encodeFitActivity,
  FTP_TESTS,
  fitFileName,
  rideLaps,
  summarizeRide,
  type FtpTestResult,
  type Lap,
  type RideSample,
  type RideSummary,
} from '@cyclotron/core'
import type { RideStartInfo, RideTotals } from '../../../shared/api'

// E5-1: samples go to main (SQLite) in small batches, so a crash loses at most a few seconds.
const FLUSH_EVERY = 5

export interface FinishedRide {
  rideId: number
  info: RideStartInfo
  summary: RideSummary
  laps: Lap[]
  fitPath: string | null
  fitError?: string
  /** Set for FTP test workouts (E6). */
  ftpTest?: FtpTestResult
}

export class RideRecorder {
  /** Everything recorded, kept in memory so finishing doesn't depend on the database. */
  readonly samples: RideSample[] = []
  private pending: RideSample[] = []
  private flushing: Promise<void> = Promise.resolve()

  private constructor(
    readonly rideId: number,
    readonly info: RideStartInfo,
  ) {}

  static async start(info: RideStartInfo): Promise<RideRecorder> {
    return new RideRecorder(await window.cyclotron.rides.start(info), info)
  }

  /** Adds one sample; samples must move forward in time. */
  add(sample: RideSample): void {
    const last = this.samples.at(-1)
    if (last && sample.t <= last.t) return
    this.samples.push(sample)
    this.pending.push(sample)
    if (this.pending.length >= FLUSH_EVERY) void this.flush()
  }

  flush(): Promise<void> {
    const batch = this.pending
    this.pending = []
    if (batch.length > 0) {
      this.flushing = this.flushing
        .then(() => window.cyclotron.rides.appendSamples(this.rideId, batch))
        .catch((e: unknown) => console.error('saving ride samples failed', e))
    }
    return this.flushing
  }

  /** Saves the ride and its FIT file. A ride without samples is discarded instead. */
  async finish(): Promise<FinishedRide | undefined> {
    await this.flush()
    if (this.samples.length === 0) {
      await window.cyclotron.rides.discard(this.rideId)
      return undefined
    }
    return finalizeRide(this.rideId, this.info, this.samples)
  }
}

/** Computes the summary, encodes the FIT file and marks the ride finished (E5-2, E5-3). */
export async function finalizeRide(
  rideId: number,
  info: RideStartInfo,
  samples: readonly RideSample[],
): Promise<FinishedRide> {
  const summary = summarizeRide(samples, info.ftpW)
  const laps = rideLaps(samples)
  const totals: RideTotals = {
    durationS: summary.elapsedS,
    timerS: summary.timerS,
    avgPowerW: summary.avgPowerW,
    npW: summary.normalizedPowerW,
    intensity: summary.intensity,
    tss: summary.tss,
    kj: summary.workKj,
    avgHrBpm: summary.avgHeartRateBpm,
    maxHrBpm: summary.maxHeartRateBpm,
    distanceM: summary.distanceM,
  }
  const bytes = encodeFitActivity({
    startedAtMs: info.startedAt,
    utcOffsetMin: info.utcOffsetMin,
    samples,
    ftpW: info.ftpW,
  })
  const fileName = fitFileName(info.startedAt, info.utcOffsetMin, info.workoutName)
  const saved = await window.cyclotron.rides.finish(rideId, totals, { fileName, bytes })
  const test = FTP_TESTS.find((w) => w.id === info.workoutId)
  const ftpTest = test ? analyzeFtpTest(test, samples) : undefined
  return { rideId, info, summary, laps, ...saved, ftpTest }
}
