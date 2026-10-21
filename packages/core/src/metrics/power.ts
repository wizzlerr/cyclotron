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

/** Training Stress Score from duration, NP and FTP. */
export function trainingStress(durationS: number, np: number, ftp: number): number {
  if (ftp <= 0) return 0
  const intensity = np / ftp
  return ((durationS * np * intensity) / (ftp * 3600)) * 100
}
