// Exercise load and training effect for the FIT session (D33): Garmin Connect shows these from the
// file (an Edge works them out during the ride) and builds short-term load from them. Garmin's
// own numbers come from Firstbeat's EPOC model, which isn't public, so these are estimates:
// - exercise load: Banister TRIMP from heart-rate reserve (same scale as Garmin's load: about 70
//   for an hour of easy endurance, 150–200 for an hour at threshold);
// - aerobic training effect: that load on Firstbeat's 0–5 scale;
// - anaerobic training effect: work done above FTP, on the same scale.

export interface TrainingEffectInput {
  /** One sample per second; paused seconds left out. */
  samples: readonly { powerW: number; heartRateBpm?: number }[]
  ftpW: number
  maxHrBpm: number
  restingHrBpm: number
}

export interface TrainingEffect {
  /** Garmin's "exercise load". */
  load: number
  /** 0–5. */
  aerobic: number
  /** 0–5. */
  anaerobic: number
}

/** Banister's weighting for men; Cyclotron has no sex in the profile. */
const TRIMP_B = 1.92
const TRIMP_A = 0.64
/** Below this much heart-rate data the load isn't worth writing. */
const MIN_HR_SECONDS = 300

/** Load → aerobic effect, roughly Firstbeat's table for a fairly fit rider. */
const AEROBIC: readonly [number, number][] = [
  [0, 0],
  [10, 1],
  [25, 2],
  [55, 3],
  [120, 4],
  [220, 5],
]
/** kJ above 105 % of FTP → anaerobic effect. */
const ANAEROBIC: readonly [number, number][] = [
  [0, 0],
  [2, 1],
  [6, 2],
  [15, 3],
  [30, 4],
  [50, 5],
]
const ANAEROBIC_FROM = 1.05

/** Estimates load and training effect; undefined without enough heart-rate data. */
export function estimateTrainingEffect(input: TrainingEffectInput): TrainingEffect | undefined {
  const { samples, ftpW, maxHrBpm, restingHrBpm } = input
  const reserve = maxHrBpm - restingHrBpm
  if (reserve <= 0) throw new RangeError('max HR must be above resting HR')
  let trimp = 0
  let hrSeconds = 0
  let aboveJ = 0
  for (const s of samples) {
    if (s.heartRateBpm) {
      const r = Math.min(1, Math.max(0, (s.heartRateBpm - restingHrBpm) / reserve))
      trimp += (r * TRIMP_A * Math.exp(TRIMP_B * r)) / 60
      hrSeconds++
    }
    if (ftpW > 0) aboveJ += Math.max(0, s.powerW - ANAEROBIC_FROM * ftpW)
  }
  if (hrSeconds < MIN_HR_SECONDS) return undefined
  return {
    load: Math.round(trimp),
    aerobic: round1(scale(AEROBIC, trimp)),
    anaerobic: round1(scale(ANAEROBIC, aboveJ / 1000)),
  }
}

/** Piecewise-linear lookup, capped at the last point. */
function scale(table: readonly [number, number][], x: number): number {
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]!
    if (x <= x1) {
      const [x0, y0] = table[i - 1]!
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
  }
  return table.at(-1)![1]
}

const round1 = (n: number): number => Math.round(n * 10) / 10
