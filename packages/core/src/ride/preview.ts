// Made-up ride numbers for the tile editor (E4-6): sample values while no ride is on, and a moving
// ride for "Simulate ride". A 45-min workout (10 min warm-up, 5 × 3 min at 105 % with 2 min easy,
// cool-down) on a gently rolling road. Pure: the time is passed in.

import { buildTimeline, type Segment, type WorkoutStep } from '../workout/model'
import type { NumericMetricId } from './layout'

export interface PreviewRide {
  /** Numbers for every metric (times in seconds, distances in km, IF as a fraction). */
  values: Record<NumericMetricId, number>
  /** Interval about to end (last 5 s before a change). */
  hot: boolean
  /** The step now and the one after (for the step texts). */
  segment: Segment
  next?: Segment
}

interface Step {
  s: number
  pct: number
}

const STEPS: Step[] = [
  { s: 600, pct: 0.55 },
  ...Array.from({ length: 5 }, (): Step[] => [
    { s: 180, pct: 1.05 },
    { s: 120, pct: 0.5 },
  ]).flat(),
  { s: 300, pct: 0.45 },
]

// Every step has a cadence target, so the cadence target tile has something to show.
const TIMELINE = buildTimeline([
  { kind: 'steady', durationS: 600, pct: 0.55, cadence: 85 },
  {
    kind: 'repeat',
    count: 5,
    steps: [
      { kind: 'steady', durationS: 180, pct: 1.05, cadence: 95 },
      { kind: 'steady', durationS: 120, pct: 0.5, cadence: 85 },
    ],
  },
  { kind: 'steady', durationS: 300, pct: 0.45, cadence: 85 },
] satisfies WorkoutStep[])

/** The preview workout, for the workout profile panel. */
export function previewTimeline(): Segment[] {
  return TIMELINE.map((s) => ({ ...s }))
}

/**
 * Live chart series of the preview ride up to `tS` (t, power, target, heart rate, cadence), at
 * most the last `maxPoints` seconds.
 */
export function previewChart(
  tS: number,
  ftpW: number,
  maxPoints = 1200,
): [number[], number[], number[], number[], number[]] {
  const end = Math.max(0, Math.floor(tS) % PREVIEW_TOTAL_S)
  const out: [number[], number[], number[], number[], number[]] = [[], [], [], [], []]
  for (let t = Math.max(0, end - maxPoints); t <= end; t++) {
    const v = previewRide(t, ftpW).values
    out[0].push(t)
    out[1].push(v.power)
    out[2].push(v.target)
    out[3].push(v.hr)
    out[4].push(v.cadence)
  }
  return out
}

export const PREVIEW_TOTAL_S = STEPS.reduce((n, s) => n + s.s, 0)
/** A moment inside the first hard interval: a good still for sample values. */
export const PREVIEW_SAMPLE_S = 600 + 95

/** Smooth made-up wobble in −1…1 (no randomness, so a frame is repeatable). */
const wobble = (t: number, seed: number): number =>
  0.6 * Math.sin(t * 0.9 + seed) + 0.3 * Math.sin(t * 2.3 + seed * 2) + 0.1 * Math.sin(t * 5.1)

function stepAt(t: number): { i: number; start: number; step: Step } {
  let start = 0
  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i]!
    if (t < start + step.s) return { i, start, step }
    start += step.s
  }
  return { i: STEPS.length - 1, start: start - STEPS.at(-1)!.s, step: STEPS.at(-1)! }
}

/** The ride `t` seconds in (wraps after the workout), for a rider of `ftpW` and `weightKg`. */
export function previewRide(tS: number, ftpW: number, weightKg = 75): PreviewRide {
  const ftp = ftpW > 0 ? ftpW : 200
  const t = ((Math.floor(tS) % PREVIEW_TOTAL_S) + PREVIEW_TOTAL_S) % PREVIEW_TOTAL_S
  const { start, step, i } = stepAt(t)
  const target = Math.round(ftp * step.pct)
  const power = Math.max(0, Math.round(target + 0.06 * target * wobble(t, 1)))
  const power3s = Math.round(target + 0.03 * target * wobble(t - 1, 1))
  const power10s = Math.round(target + 0.015 * target * wobble(t - 4, 1))
  const left = start + step.s - t
  // HR follows the effort with a lag: 100 bpm easy, ~175 at threshold.
  const effort = Math.min(1.1, (step.pct * Math.min(1, (t - start + 30) / 90) + 0.5) / 1.5)
  const hr = Math.round(95 + 80 * effort + 2 * wobble(t, 3))
  // Wobbles enough around the step's cadence to show every target tint.
  const cadenceTarget = step.pct > 0.9 ? 95 : 85
  const cadence = Math.round(cadenceTarget - 1 + 8 * wobble(t / 3, 5))
  const grade = 2.5 * Math.sin(t / 240) + 0.6 * wobble(t / 20, 7)
  const speed = Math.max(8, 34 - 3.2 * grade + 2 * (step.pct - 0.7) * 10 * 0.3)
  // Ride totals from the elapsed time: close enough for a preview.
  const hours = t / 3600
  const avgPower = Math.round(ftp * (0.55 + 0.12 * Math.min(1, t / 1500)))
  const np = Math.round(avgPower * (1 + 0.12 * Math.min(1, t / 1200)))
  const intensity = np / ftp
  const distance = (speed * 0.9 * t) / 3600
  const total = 42.3
  return {
    hot: left <= 5 && i < STEPS.length - 1,
    segment: TIMELINE[i]!,
    next: TIMELINE[i + 1],
    values: {
      power3s,
      power,
      power10s,
      target,
      wkg: power3s / weightKg,
      intervalAvg: Math.round(target + 0.01 * target * wobble(start, 2)),
      avgPower,
      maxPower: Math.round(ftp * (t > 600 ? 1.32 : 0.8)),
      np,
      if: intensity,
      tss: Math.round(hours * intensity * intensity * 100),
      kcal: Math.round(avgPower * t * 0.001 * 1.0),
      hr,
      avgHr: Math.round(118 + 20 * Math.min(1, t / 1500)),
      maxHr: Math.round(t > 700 ? 176 : 128),
      cadence,
      cadenceTarget,
      avgCadence: 88,
      speed,
      intervalLeft: left,
      elapsed: t,
      total: PREVIEW_TOTAL_S,
      workoutLeft: PREVIEW_TOTAL_S - t,
      grade,
      distance,
      toGo: Math.max(0, total - distance),
      elevation: Math.round(420 + 60 * (1 - Math.cos(t / 240))),
      climbed: Math.round(t * 0.12),
    },
  }
}
