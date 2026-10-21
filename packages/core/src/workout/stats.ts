import { normalizedPower, trainingStress } from '../metrics/power'
import { buildTimeline, segmentPctAt, timelineDurationS, type Workout } from './model'

// Assumed efforts for steps without a target, so they still count toward IF/TSS.
const FREERIDE_PCT = 0.5
const MAXEFFORT_PCT = 1.5

export interface WorkoutStats {
  durationS: number
  /** Intensity Factor of the planned target profile. */
  intensity: number
  tss: number
}

/** Planned duration, IF and TSS, from the 1 s target profile (FTP-independent). */
export function workoutStats(workout: Workout): WorkoutStats {
  const profile = workoutProfile(workout)
  const np = normalizedPower(profile)
  return {
    durationS: profile.length,
    intensity: np,
    tss: trainingStress(profile.length, np, 1),
  }
}

/** Target as a fraction of FTP for every second of the workout. */
export function workoutProfile(workout: Workout): number[] {
  const timeline = buildTimeline(workout.steps)
  const out = new Array<number>(Math.round(timelineDurationS(timeline)))
  for (const seg of timeline) {
    const pct =
      seg.kind === 'freeride' ? FREERIDE_PCT : seg.kind === 'maxeffort' ? MAXEFFORT_PCT : undefined
    const start = Math.round(seg.startS)
    const end = Math.round(seg.startS + seg.durationS)
    for (let t = start; t < end; t++) out[t] = pct ?? segmentPctAt(seg, t - seg.startS + 0.5)
  }
  return out
}
