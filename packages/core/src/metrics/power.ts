// Power metrics (DESIGN.md §5). Inputs are 1 Hz samples.

/** Normalized Power: 30 s rolling average, 4th power, mean, 4th root. 0 for < 30 samples. */
export function normalizedPower(samples: readonly number[]): number {
  const window = 30
  if (samples.length < window) return 0
  let sum = 0
  for (let i = 0; i < window; i++) sum += samples[i]!
  let acc = (sum / window) ** 4
  let n = 1
  for (let i = window; i < samples.length; i++) {
    sum += samples[i]! - samples[i - window]!
    acc += (sum / window) ** 4
    n++
  }
  return (acc / n) ** 0.25
}

/** Best average over any `windowS` consecutive samples (e.g. best 1 min); undefined if too short. */
export function bestAverage(samples: readonly number[], windowS: number): number | undefined {
  if (windowS <= 0 || samples.length < windowS) return undefined
  let sum = 0
  for (let i = 0; i < windowS; i++) sum += samples[i]!
  let best = sum
  for (let i = windowS; i < samples.length; i++) {
    sum += samples[i]! - samples[i - windowS]!
    best = Math.max(best, sum)
  }
  return best / windowS
}

/** Human gross efficiency on a bike: ~24 % of food energy becomes work at the pedals. */
const GROSS_EFFICIENCY = 0.24
const KJ_PER_KCAL = 4.184

/** Calories burned for a given amount of work; about 1 kcal per kJ, the usual cycling estimate. */
export function caloriesKcal(workKj: number): number {
  return workKj / GROSS_EFFICIENCY / KJ_PER_KCAL
}

/** Training Stress Score from duration, NP and FTP. */
export function trainingStress(durationS: number, np: number, ftp: number): number {
  if (ftp <= 0) return 0
  const intensity = np / ftp
  return ((durationS * np * intensity) / (ftp * 3600)) * 100
}
