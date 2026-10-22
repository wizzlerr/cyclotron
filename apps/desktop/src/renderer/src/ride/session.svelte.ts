import {
  DEFAULT_PHYSICS,
  FREE_RIDE_ID,
  FREE_RIDE_WORKOUT,
  LiveRideMetrics,
  RampFailureDetector,
  routeAt,
  RouteRider,
  trainerGradePct,
  WorkoutPlayer,
  type LiveMetrics,
  type PlayerState,
  type RideSample,
  type Route,
  type RoutePosition,
  type TrainerControl,
  type Workout,
} from '@cyclotron/core'
import { devices } from '../devices/devices.svelte'
import { routeName, workoutName } from '../i18n/content'
import { t } from '../i18n/t'
import { profile } from '../profile.svelte'
import { countdownCue, finishCue, stepCue } from './cues'
import { RideRecorder, type FinishedRide } from './recorder'

const TICK_MS = 1000
const COUNTDOWN_S = 3
/** Device values older than this are recorded as missing rather than repeated. */
const STALE_MS = 3000
/**
 * A longer gap between ticks means the PC slept or the app froze. The ride is paused instead of
 * fast-forwarding the workout by the length of the gap (seen in testing: a 1 h sleep finished a
 * ramp test).
 */
const MAX_GAP_MS = 5000

/** Live chart series, one point per recorded second: t, power, target, heart rate, cadence. */
export type ChartData = [
  number[],
  (number | null)[],
  (number | null)[],
  (number | null)[],
  (number | null)[],
]

const emptyChart = (): ChartData => [[], [], [], [], []]

/** Workout id of a ride along a route without a workout: free ride, following the grade. */
export const ROUTE_RIDE_ID = 'route'

/** Live progress along a route (E13-4/E13-5). */
export interface RouteState {
  position: RoutePosition
  speedKmh: number
  /** Ridden so far (keeps counting past the end when a workout wraps the route). */
  distanceM: number
  remainingM: number
  climbedM: number
}

/**
 * Drives the core workout player from a drift-corrected 1 Hz tick (E3-3, E3-7), sends its targets
 * to the trainer and records the ride (E5-1). The player itself is pure; time and I/O live here.
 * A free ride is a workout with one long free-ride step.
 */
class RideSession {
  workout = $state.raw<Workout | undefined>()
  player = $state.raw<WorkoutPlayer | undefined>()
  state = $state.raw<PlayerState | undefined>()
  muted = $state(false)
  /** Rider-chosen control during free-ride steps (e.g. ERG ±10 W); cleared when the step ends. */
  manual = $state.raw<TrainerControl | undefined>()
  /** Set once a finished ride has been saved. */
  result = $state.raw<FinishedRide | undefined>()
  saving = $state(false)
  /** Words itself at render, so it follows a language change. */
  error = $state<(() => string) | undefined>()
  /** Ride totals so far (E4-3); undefined until the ride starts. */
  metrics = $state.raw<LiveMetrics | undefined>()
  /** Not reactive (it grows every second); `chartVersion` changes when it does. */
  chart: ChartData = emptyChart()
  chartVersion = $state(0)
  /** Average power in the current segment so far, for pacing efforts like the 20-min test. */
  intervalAvgW = $state<number | undefined>()
  /** Shown when the ramp test detected failure and moved on to the cooldown. */
  /** Words itself at render, so it follows a language change. */
  notice = $state<(() => string) | undefined>()
  private pausedBySuspend = false
  /** The route being ridden, if any (E13). */
  route = $state.raw<Route | undefined>()
  routeState = $state.raw<RouteState | undefined>()

  private timer: ReturnType<typeof setTimeout> | undefined
  private nextTickAt = 0
  private lastTickAt = 0
  private startedAtPerf = 0
  private sent: TrainerControl | undefined
  private recorder: RideRecorder | undefined
  private live: LiveRideMetrics | undefined
  private rampFailure = new RampFailureDetector()
  private interval = { segment: -1, sum: 0, n: 0 }
  private rider: RouteRider | undefined

  /** Loads a workout, ready to start. Replaces any workout that isn't running. */
  load(workout: Workout): boolean {
    if (this.active || this.saving) return false
    this.stopTicking()
    this.workout = workout
    this.player = new WorkoutPlayer(workout, profile.ftpW)
    this.sent = undefined
    this.manual = undefined
    this.result = undefined
    this.error = undefined
    this.recorder = undefined
    this.live = undefined
    this.metrics = undefined
    this.chart = emptyChart()
    this.chartVersion++
    this.rampFailure.reset()
    this.interval = { segment: -1, sum: 0, n: 0 }
    this.intervalAvgW = undefined
    this.notice = undefined
    this.pausedBySuspend = false
    this.route = undefined
    this.routeState = undefined
    this.rider = undefined
    this.state = this.player.state()
    return true
  }

  /**
   * Loads a ride along `route` (E13-4). Without a workout it's a free ride where the trainer
   * follows the grade and the ride ends at the finish; with one, the workout sets the power and
   * the route only provides the scenery (E13-8), starting over if it ends first.
   */
  loadRoute(route: Route, workout?: Workout): boolean {
    const w = workout ?? { ...FREE_RIDE_WORKOUT, id: ROUTE_RIDE_ID, name: routeName(route) }
    if (!this.load(w)) return false
    this.route = route
    this.routeState = {
      position: routeAt(route, 0),
      speedKmh: 0,
      distanceM: 0,
      remainingM: route.distanceM,
      climbedM: 0,
    }
    return true
  }

  /** Starts a recorded free ride, keeping ERG on if it already is. */
  startFreeRide(): void {
    if (!this.load(FREE_RIDE_WORKOUT)) return
    if (devices.control.kind === 'erg') this.manual = devices.control
    this.start()
  }

  /** Running or paused. */
  get active(): boolean {
    return this.state?.status === 'running' || this.state?.status === 'paused'
  }

  /** No plan to follow: a free ride, or a route ride without a workout. */
  get isFreeRide(): boolean {
    return this.workout?.id === FREE_RIDE_ID || this.workout?.id === ROUTE_RIDE_ID
  }

  /** The ERG target in effect, including a manual one in a free-ride step. */
  get targetW(): number | undefined {
    const c = this.state && this.effectiveControl(this.state)
    return c?.kind === 'erg' ? c.watts : undefined
  }

  start(): void {
    if (!this.player || this.state?.status !== 'ready') return
    const workout = this.player.workout
    this.player.start()
    void window.cyclotron.ride.keepAwake(true)
    this.startedAtPerf = performance.now()
    this.lastTickAt = this.startedAtPerf
    this.nextTickAt = this.startedAtPerf
    this.live = new LiveRideMetrics(this.player.ftpW, profile.weightKg)
    this.metrics = this.live.snapshot()
    const route = this.route
    if (route) {
      this.rider = new RouteRider(
        route,
        { ...DEFAULT_PHYSICS, massKg: profile.systemMassKg },
        { wrap: workout.id !== ROUTE_RIDE_ID },
      )
    }
    RideRecorder.start({
      startedAt: Date.now(),
      utcOffsetMin: -new Date().getTimezoneOffset(),
      workoutId: workout.id,
      workoutName:
        route && workout.id !== ROUTE_RIDE_ID
          ? `${workoutName(workout)} · ${routeName(route)}`
          : workoutName(workout),
      ftpW: this.player.ftpW,
      routeId: route?.id,
    })
      .then((r) => (this.recorder = r))
      .catch((e: unknown) => (this.error = () => t().ride.notices.recordingFailed(message(e))))
    this.scheduleTick()
    this.refresh()
  }

  pause(): void {
    this.advanceToNow()
    this.player?.pause()
    // Stopped means stopped: no coasting on after a break.
    if (this.rider) this.rider.speedMps = 0
    this.refresh()
  }

  resume(): void {
    if (this.pausedBySuspend) {
      this.notice = undefined
      this.pausedBySuspend = false
    }
    this.advanceToNow()
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

  /** Sets the trainer during a free-ride step; `undefined` returns to the step's own control. */
  setManual(control: TrainerControl | undefined): void {
    this.manual = control
    this.refresh()
  }

  /** Deletes the just-finished ride and its FIT file. */
  async discard(): Promise<void> {
    if (this.result) await window.cyclotron.rides.discard(this.result.rideId)
    this.close()
  }

  /** Closes a finished (or not yet started) workout. */
  close(): void {
    if (this.active || this.saving) return
    this.stopTicking()
    this.workout = undefined
    this.player = undefined
    this.state = undefined
    this.result = undefined
    this.manual = undefined
    this.error = undefined
    this.metrics = undefined
    this.chart = emptyChart()
    this.chartVersion++
    this.notice = undefined
    this.pausedBySuspend = false
    this.route = undefined
    this.routeState = undefined
    this.rider = undefined
  }

  private scheduleTick(): void {
    // Aim at fixed 1 s boundaries so timer lateness doesn't accumulate.
    this.nextTickAt += TICK_MS
    const now = performance.now()
    // After a sleep don't fire a burst of catch-up ticks; restart the 1 s grid from now.
    if (this.nextTickAt < now - TICK_MS) this.nextTickAt = now + TICK_MS
    const delay = Math.max(0, this.nextTickAt - now)
    this.timer = setTimeout(() => {
      this.advanceToNow()
      this.refresh()
      this.record()
      if (this.state?.status === 'finished') return
      this.scheduleTick()
    }, delay)
  }

  private advanceToNow(): void {
    const now = performance.now()
    const gapMs = now - this.lastTickAt
    if (this.state?.status === 'running') {
      if (gapMs > MAX_GAP_MS) {
        this.player?.pause()
        const s = Math.round(gapMs / 1000)
        this.notice = () => t().ride.notices.suspended(s)
        this.pausedBySuspend = true
      } else {
        this.player?.advance(gapMs / 1000)
        this.ride(gapMs / 1000)
      }
    }
    this.lastTickAt = now
  }

  /** Moves along the route with the power being pushed now. */
  private ride(dtS: number): void {
    const rider = this.rider
    if (!rider) return
    const fresh = performance.now() - devices.dataAt < STALE_MS
    rider.step(fresh ? (devices.data?.powerW ?? 0) : 0, dtS)
    this.routeState = {
      position: rider.position,
      speedKmh: rider.speedMps * 3.6,
      distanceM: rider.distanceM,
      remainingM: rider.remainingM,
      climbedM: rider.climbedM,
    }
    if (rider.finished) {
      this.player?.finish()
      const route = rider.route
      this.notice = () => t().ride.notices.routeFinished(routeName(route))
    }
  }

  private record(): void {
    const s = this.state
    if (!s || s.status === 'ready') return
    const now = performance.now()
    const data = now - devices.dataAt < STALE_MS ? devices.data : undefined
    const bpm = now - devices.bpmAt < STALE_MS ? devices.bpm : undefined
    const sample: RideSample = {
      t: Math.round((now - this.startedAtPerf) / 1000),
      powerW: data?.powerW,
      cadenceRpm: data?.cadenceRpm,
      // On a route, speed is the virtual road speed, not the trainer's flywheel speed.
      speedKmh: this.routeState && this.rider ? this.routeState.speedKmh : data?.speedKmh,
      heartRateBpm: bpm,
      targetW: this.targetW,
      segment: s.segment?.index,
      paused: s.status === 'paused',
    }
    if (this.rider && this.routeState) {
      const p = this.routeState.position
      sample.lat = p.lat
      sample.lon = p.lon
      sample.altitudeM = Math.round(p.ele * 10) / 10
      sample.distanceM = Math.round(this.routeState.distanceM * 10) / 10
    }
    this.recorder?.add(sample)
    this.trackInterval(sample)
    this.checkRampFailure(sample)
    if (this.live) {
      this.live.add(sample)
      this.metrics = this.live.snapshot()
    }
    const [t, power, target, hr, cadence] = this.chart
    if (sample.t > (t.at(-1) ?? 0)) {
      t.push(sample.t)
      power.push(sample.paused ? null : (sample.powerW ?? null))
      target.push(sample.targetW ?? null)
      hr.push(sample.heartRateBpm ?? null)
      cadence.push(sample.cadenceRpm ?? null)
      this.chartVersion++
    }
  }

  private trackInterval(sample: RideSample): void {
    const seg = sample.segment ?? -1
    if (seg !== this.interval.segment) this.interval = { segment: seg, sum: 0, n: 0 }
    if (sample.paused) return
    this.interval.sum += sample.powerW ?? 0
    this.interval.n++
    this.intervalAvgW = this.interval.sum / this.interval.n
  }

  /** E6-1: when the rider can't hold the ramp any more, go straight to the cooldown. */
  private checkRampFailure(sample: RideSample): void {
    const s = this.state
    if (!this.player || this.workout?.ftpTest !== 'ramp' || s?.status !== 'running') return
    if (!s.segment?.effort) return
    if (!this.rampFailure.update(sample)) return
    const cooldown = this.player.timeline.find((x) => x.index > s.segment!.index && !x.effort)
    if (cooldown) this.player.skipTo(cooldown.index)
    this.notice = () => t().ride.notices.rampDone
    this.refresh()
  }

  private refresh(): void {
    if (!this.player) return
    const prev = this.state
    const next = this.player.state()
    if (prev?.segment?.index !== next.segment?.index && prev?.status !== 'ready') {
      this.manual = undefined
    }
    this.state = next
    if (next.status !== 'ready') this.applyControl(this.effectiveControl(next))
    if (!this.muted) this.cue(prev, next)
    if (next.status === 'finished' && prev?.status !== 'finished') void this.finishRide()
  }

  private async finishRide(): Promise<void> {
    this.stopTicking()
    void window.cyclotron.ride.keepAwake(false)
    const recorder = this.recorder
    this.recorder = undefined
    if (!recorder) return
    this.saving = true
    try {
      this.result = await recorder.finish()
    } catch (e) {
      const why = message(e)
      this.error = () => t().ride.notices.savingFailed(why)
    } finally {
      this.saving = false
    }
  }

  private effectiveControl(s: PlayerState): TrainerControl {
    const freeStep = s.status === 'running' && s.segment?.kind === 'freeride'
    if (freeStep && this.manual) return this.manual
    // On a route, free riding means riding the road: the trainer follows the grade (E13-4).
    if (freeStep && this.rider) {
      return {
        kind: 'simulation',
        gradePct: trainerGradePct(this.rider.position.gradePct, profile.difficulty),
      }
    }
    return s.control
  }

  private applyControl(control: TrainerControl): void {
    if (sameControl(control, this.sent)) return
    this.sent = control
    void devices.setControl(control)
  }

  private cue(prev: PlayerState | undefined, next: PlayerState): void {
    if (prev?.status === 'running' && next.status === 'finished') {
      if (!this.isFreeRide) finishCue()
      return
    }
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

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export const ride = new RideSession()
