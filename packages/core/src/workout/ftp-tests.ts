// FTP tests (E6, DESIGN.md §5). Pure: workouts, result calculation and ramp-failure detection.

import { bestAverage } from '../metrics/power'
import type { RideSample } from '../ride/summary'
import { buildTimeline, type Workout, type WorkoutStep } from './model'

/** Ramp test: 1-minute steps, +6 % FTP each, from 50 % until the rider can't hold the target. */
const RAMP_START_PCT = 0.5
const RAMP_STEP_PCT = 0.06
const RAMP_STEPS = 25 // up to 194 % FTP; nobody gets there

export const RAMP_TEST: Workout = {
  id: 'builtin.ftp.ramp',
  name: 'FTP Ramp Test',
  type: 'ftp-test',
  description:
    'Warm up 5 minutes, then the target rises every minute until you can’t hold it. ' +
    'Keep cadence up and go until failure; the test ends itself when power drops. ' +
    'FTP = 75 % of your best 1-minute power. About 20–30 minutes.',
  source: 'builtin',
  ftpTest: 'ramp',
  steps: [
    { kind: 'ramp', durationS: 300, fromPct: 0.35, toPct: 0.5 },
    ...Array.from({ length: RAMP_STEPS }, (_, i): WorkoutStep => ({
      kind: 'steady',
      durationS: 60,
      pct: Math.round((RAMP_START_PCT + RAMP_STEP_PCT * i) * 100) / 100,
      effort: true,
    })),
    { kind: 'ramp', durationS: 300, fromPct: 0.5, toPct: 0.35 },
  ],
}

export const TWENTY_MIN_TEST: Workout = {
  id: 'builtin.ftp.20min',
  name: 'FTP 20-Minute Test',
  type: 'ftp-test',
  description:
    'Warm-up with openers and a 5-minute hard effort, recovery, then 20 minutes as hard as you ' +
    'can hold evenly (ERG off: pace it with your gears). FTP = 95 % of the 20-minute average.',
  source: 'builtin',
  ftpTest: '20min',
  steps: [
    { kind: 'ramp', durationS: 300, fromPct: 0.45, toPct: 0.65 },
    { kind: 'steady', durationS: 300, pct: 0.65 },
    {
      kind: 'repeat',
      count: 3,
      steps: [
        { kind: 'steady', durationS: 60, pct: 1.05 },
        { kind: 'steady', durationS: 60, pct: 0.5 },
      ],
    },
    { kind: 'maxeffort', durationS: 300 },
    { kind: 'steady', durationS: 600, pct: 0.5 },
    { kind: 'maxeffort', durationS: 1200, effort: true },
    { kind: 'ramp', durationS: 600, fromPct: 0.55, toPct: 0.4 },
  ],
}

export const FTP_TESTS: readonly Workout[] = [RAMP_TEST, TWENTY_MIN_TEST]

export type FtpTestResult =
  | {
      ok: true
      kind: 'ramp' | '20min'
      ftpW: number
      /** The number the FTP comes from: best 1-min power (ramp) or 20-min average. */
      basisW: number
    }
  | { ok: false; kind: 'ramp' | '20min'; reason: string }

/** Computes the FTP from a finished test ride. Samples outside the effort segments are ignored. */
export function analyzeFtpTest(workout: Workout, samples: readonly RideSample[]): FtpTestResult {
  const kind = workout.ftpTest
  if (!kind) throw new Error(`${workout.id} is not an FTP test`)
  const effortSegments = new Set(
    buildTimeline(workout.steps)
      .filter((s) => s.effort)
      .map((s) => s.index),
  )
  const power = samples
    .filter((s) => !s.paused && s.segment !== undefined && effortSegments.has(s.segment))
    .map((s) => s.powerW ?? 0)

  if (kind === 'ramp') {
    const best1min = bestAverage(power, 60)
    if (best1min === undefined) {
      return { ok: false, kind, reason: 'The ramp lasted less than a minute.' }
    }
    return { ok: true, kind, ftpW: Math.round(best1min * 0.75), basisW: Math.round(best1min) }
  }

  // Allow a little slack for a late start or an early stop, but not a shortened test.
  if (power.length < 19 * 60) {
    return { ok: false, kind, reason: 'The 20-minute effort wasn’t completed.' }
  }
  const avg = power.reduce((a, b) => a + b, 0) / power.length
  return { ok: true, kind, ftpW: Math.round(avg * 0.95), basisW: Math.round(avg) }
}

/**
 * Ends a ramp test when the rider can no longer hold the target: power under 80 % of target for
 * 10 s in a row, or cadence under 40 rpm for 5 s. Feed it one sample per second during ramp steps.
 */
export class RampFailureDetector {
  private lowPowerS = 0
  private lowCadenceS = 0

  update(sample: { powerW?: number; cadenceRpm?: number; targetW?: number }): boolean {
    const target = sample.targetW ?? 0
    if (target <= 0) return false
    this.lowPowerS = (sample.powerW ?? 0) < target * 0.8 ? this.lowPowerS + 1 : 0
    this.lowCadenceS = (sample.cadenceRpm ?? 0) < 40 ? this.lowCadenceS + 1 : 0
    return this.lowPowerS >= 10 || this.lowCadenceS >= 5
  }

  reset(): void {
    this.lowPowerS = 0
    this.lowCadenceS = 0
  }
}
