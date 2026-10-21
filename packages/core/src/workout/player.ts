// Workout player (E3-3, E3-4, DESIGN.md §4.3): a pure state machine. The caller advances it with
// elapsed real time; paused time doesn't move the workout forward.

import type { TrainerControl } from '../sim/trainer-sim'
import {
  buildTimeline,
  hasTarget,
  segmentPctAt,
  timelineDurationS,
  type Segment,
  type Workout,
} from './model'

export type PlayerStatus = 'ready' | 'running' | 'paused' | 'finished'

export const MIN_INTENSITY = 0.5
export const MAX_INTENSITY = 1.5

export interface PlayerState {
  status: PlayerStatus
  /** Workout time in seconds, excluding pauses. */
  positionS: number
  totalS: number
  segment: Segment | undefined
  segmentElapsedS: number
  segmentRemainingS: number
  /** ERG target in watts, or undefined for steps without one (free ride, max effort). */
  targetW: number | undefined
  next: Segment | undefined
  /** Target at the start of the next segment, if it has one. */
  nextTargetW: number | undefined
  /** Multiplier on every target, e.g. 1.05 = 105 %. */
  intensity: number
  /** What the trainer should do right now. */
  control: TrainerControl
}

export class WorkoutPlayer {
  readonly timeline: Segment[]
  readonly totalS: number
  private status: PlayerStatus = 'ready'
  private positionS = 0
  private intensity = 1

  constructor(
    readonly workout: Workout,
    readonly ftpW: number,
  ) {
    this.timeline = buildTimeline(workout.steps)
    this.totalS = timelineDurationS(this.timeline)
  }

  start(): void {
    if (this.status !== 'ready') return
    this.status = this.totalS > 0 ? 'running' : 'finished'
  }

  /** Moves the workout forward by `dtS` seconds of real time (ignored unless running). */
  advance(dtS: number): void {
    if (this.status !== 'running' || dtS <= 0) return
    this.seek(this.positionS + dtS)
  }

  pause(): void {
    if (this.status === 'running') this.status = 'paused'
  }

  resume(): void {
    if (this.status === 'paused') this.status = 'running'
  }

  /** Jumps to the start of the next segment (or finishes on the last one). */
  skip(): void {
    if (this.status !== 'running' && this.status !== 'paused') return
    const seg = this.segmentAt(this.positionS)
    if (seg) this.seek(seg.startS + seg.durationS)
  }

  finish(): void {
    this.status = 'finished'
  }

  setIntensity(intensity: number): void {
    const rounded = Math.round(intensity * 100) / 100
    this.intensity = Math.min(MAX_INTENSITY, Math.max(MIN_INTENSITY, rounded))
  }

  state(): PlayerState {
    const segment = this.status === 'finished' ? undefined : this.segmentAt(this.positionS)
    const segmentElapsedS = segment ? this.positionS - segment.startS : 0
    const next = segment ? this.timeline[segment.index + 1] : undefined
    const targetW =
      segment && hasTarget(segment) ? this.watts(segmentPctAt(segment, segmentElapsedS)) : undefined
    return {
      status: this.status,
      positionS: this.positionS,
      totalS: this.totalS,
      segment,
      segmentElapsedS,
      segmentRemainingS: segment ? segment.durationS - segmentElapsedS : 0,
      targetW,
      next,
      nextTargetW: next && hasTarget(next) ? this.watts(next.fromPct) : undefined,
      intensity: this.intensity,
      control: this.control(segment, targetW),
    }
  }

  private control(segment: Segment | undefined, targetW: number | undefined): TrainerControl {
    if (this.status !== 'running' || !segment) return { kind: 'free' }
    if (targetW !== undefined) return { kind: 'erg', watts: targetW }
    if (segment.kind === 'freeride' && segment.gradePct !== undefined) {
      return { kind: 'simulation', gradePct: segment.gradePct }
    }
    return { kind: 'free' }
  }

  private watts(pct: number): number {
    return Math.round(pct * this.intensity * this.ftpW)
  }

  private seek(positionS: number): void {
    this.positionS = Math.min(positionS, this.totalS)
    if (this.positionS >= this.totalS) this.status = 'finished'
  }

  private segmentAt(positionS: number): Segment | undefined {
    return this.timeline.find((s) => positionS < s.startS + s.durationS)
  }
}
