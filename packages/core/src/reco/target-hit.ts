// How well a ride held its ERG targets (E11-8): the share of work seconds ridden at ≥ 85 % of the
// target. Work = target at or above 80 % of FTP, not paused.

const WORK_PCT = 0.8
const HELD_PCT = 0.85
/** Fewer work seconds than this: too little to judge. */
const MIN_WORK_S = 60

export interface TargetSample {
  power: number | null
  target: number | null
  paused?: boolean
}

/** Share of work seconds on target, or undefined when the ride had too little work to judge. */
export function targetHit(samples: readonly TargetSample[], ftpW: number): number | undefined {
  let work = 0
  let held = 0
  for (const s of samples) {
    if (s.paused || s.target == null || s.target < ftpW * WORK_PCT) continue
    work++
    if ((s.power ?? 0) >= s.target * HELD_PCT) held++
  }
  return work < MIN_WORK_S ? undefined : held / work
}
