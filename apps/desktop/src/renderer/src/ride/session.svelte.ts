import { WorkoutPlayer, type PlayerState, type TrainerControl, type Workout } from '@cyclotron/core'
import { devices } from '../devices/devices.svelte'
import { profile } from '../profile.svelte'
import { countdownCue, finishCue, stepCue } from './cues'

const TICK_MS = 1000
const COUNTDOWN_S = 3

/**
 * Drives the core workout player from a drift-corrected 1 Hz tick (E3-3, E3-7) and sends its
 * targets to the trainer. The player itself is pure; time and I/O live here.
 */
class RideSession {
  workout = $state.raw<Workout | undefined>()
  player = $state.raw<WorkoutPlayer | undefined>()
  state = $state.raw<PlayerState | undefined>()
  muted = $state(false)

  private timer: ReturnType<typeof setTimeout> | undefined
  private nextTickAt = 0
  private lastTickAt = 0
  private sent: TrainerControl | undefined

  /** Loads a workout, ready to start. Replaces any workout that isn't running. */
  load(workout: Workout): boolean {
    if (this.active) return false
    this.stopTicking()
    this.workout = workout
    this.player = new WorkoutPlayer(workout, profile.ftpW)
    this.sent = undefined
    this.state = this.player.state()
    return true
  }

  /** Running or paused. */
  get active(): boolean {
    return this.state?.status === 'running' || this.state?.status === 'paused'
  }

  start(): void {
    if (!this.player || this.state?.status !== 'ready') return
    this.player.start()
    void window.cyclotron.ride.keepAwake(true)
    this.lastTickAt = performance.now()
    this.nextTickAt = this.lastTickAt
    this.scheduleTick()
    this.refresh()
  }

  pause(): void {
    this.advanceToNow()
    this.player?.pause()
    this.refresh()
  }

  resume(): void {
    // Paused time must not count: restart the clock from now.
    this.lastTickAt = performance.now()
    this.player?.resume()
    this.refresh()
  }

  skip(): void {
    this.advanceToNow()
    this.player?.skip()
    this.refresh()
  }

  end(): void {
    this.advanceToNow()
    this.player?.finish()
    this.refresh()
  }

  /** Changes every target by `delta`, e.g. +0.05 for +5 % (E3-4). */
  adjustIntensity(delta: number): void {
    if (!this.player || !this.state) return
    this.player.setIntensity(this.state.intensity + delta)
    this.refresh()
  }

  resetIntensity(): void {
    this.player?.setIntensity(1)
    this.refresh()
  }

  /** Closes a finished (or not yet started) workout. */
  close(): void {
    if (this.active) return
    this.stopTicking()
    this.workout = undefined
    this.player = undefined
    this.state = undefined
  }

  private scheduleTick(): void {
    // Aim at fixed 1 s boundaries so timer lateness doesn't accumulate.
    this.nextTickAt += TICK_MS
    const delay = Math.max(0, this.nextTickAt - performance.now())
    this.timer = setTimeout(() => {
      this.advanceToNow()
      this.refresh()
      if (this.state?.status === 'finished') return
      this.scheduleTick()
    }, delay)
  }

  private advanceToNow(): void {
    const now = performance.now()
    if (this.state?.status === 'running') this.player?.advance((now - this.lastTickAt) / 1000)
    this.lastTickAt = now
  }

  private refresh(): void {
    if (!this.player) return
    const prev = this.state
    const next = this.player.state()
    this.state = next
    if (next.status !== 'ready') this.applyControl(next.control)
    if (!this.muted) this.cue(prev, next)
    if (next.status === 'finished') {
      this.stopTicking()
      void window.cyclotron.ride.keepAwake(false)
    }
  }

  private applyControl(control: TrainerControl): void {
    if (sameControl(control, this.sent)) return
    this.sent = control
    void devices.setControl(control)
  }

  private cue(prev: PlayerState | undefined, next: PlayerState): void {
    if (prev?.status === 'running' && next.status === 'finished') return finishCue()
    if (next.status !== 'running' || prev?.status !== 'running') return
    if (prev.segment?.index !== next.segment?.index) return stepCue()
    if (!next.next) return
    const before = Math.ceil(prev.segmentRemainingS)
    const now = Math.ceil(next.segmentRemainingS)
    if (now < before && now <= COUNTDOWN_S && now > 0) countdownCue()
  }

  private stopTicking(): void {
    clearTimeout(this.timer)
    this.timer = undefined
  }
}

function sameControl(a: TrainerControl, b: TrainerControl | undefined): boolean {
  if (!b || a.kind !== b.kind) return false
  switch (a.kind) {
    case 'free':
      return true
    case 'erg':
      return b.kind === 'erg' && a.watts === b.watts
    case 'simulation':
      return b.kind === 'simulation' && a.gradePct === b.gradePct
    case 'resistance':
      return b.kind === 'resistance' && a.level === b.level
  }
}

export const ride = new RideSession()
