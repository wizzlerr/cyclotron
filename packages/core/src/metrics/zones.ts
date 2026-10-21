export interface PowerZone {
  zone: number
  name: string
  /** Upper bound as a fraction of FTP (inclusive); Infinity for the top zone. */
  maxPct: number
}

/** Coggan 7-zone model (DESIGN.md §5). */
export const POWER_ZONES: readonly PowerZone[] = [
  { zone: 1, name: 'Recovery', maxPct: 0.55 },
  { zone: 2, name: 'Endurance', maxPct: 0.75 },
  { zone: 3, name: 'Tempo', maxPct: 0.9 },
  { zone: 4, name: 'Threshold', maxPct: 1.05 },
  { zone: 5, name: 'VO2max', maxPct: 1.2 },
  { zone: 6, name: 'Anaerobic', maxPct: 1.5 },
  { zone: 7, name: 'Neuromuscular', maxPct: Infinity },
]

/** Returns the 1-based Coggan power zone for `watts` at the given FTP. */
export function powerZone(watts: number, ftp: number): number {
  if (ftp <= 0) throw new RangeError('ftp must be positive')
  const pct = watts / ftp
  return POWER_ZONES.find((z) => pct <= z.maxPct)!.zone
}
