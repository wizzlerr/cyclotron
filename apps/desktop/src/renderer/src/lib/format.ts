import type { Segment } from '@cyclotron/core'

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export const formatPct = (fraction: number): string => `${Math.round(fraction * 100)} %`

/** One line for a workout step, e.g. "Ramp 50 % → 75 % · 2/3". */
export function describeSegment(seg: Segment | undefined): string {
  if (!seg) return ''
  const rep = seg.repeat ? ` · ${seg.repeat.index}/${seg.repeat.count}` : ''
  const cad = seg.cadence ? ` · ${seg.cadence} rpm` : ''
  switch (seg.kind) {
    case 'steady':
      return `Steady ${formatPct(seg.toPct)}${cad}${rep}`
    case 'ramp':
      return `Ramp ${formatPct(seg.fromPct)} → ${formatPct(seg.toPct)}${cad}${rep}`
    case 'freeride':
      return `Free ride${rep}`
    case 'maxeffort':
      return seg.effort ? 'Test effort: as hard as you can hold evenly' : `Max effort${rep}`
  }
}

/** 12345 → "12.3 km", 850 → "0.85 km". */
export function formatKm(metres: number): string {
  const km = Math.max(0, metres) / 1000
  return `${km < 1 ? km.toFixed(2) : km.toFixed(1)} km`
}

/** Power-curve durations: 5 → "5 s", 300 → "5 min", 3600 → "60 min". */
export function durationLabel(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`
}
