// Progress along a route (E13-4): speed from the physics model, distance, position and climbing.
// Pure; the ride session feeds it power and elapsed time.

import { stepSpeed, type PhysicsParams } from './physics'
import { routeAt, type Route, type RoutePosition } from './route'

export interface RouteRiderOptions {
  /** Start again from the beginning at the end (workouts on a route), instead of stopping. */
  wrap: boolean
}

export class RouteRider {
  speedMps = 0
  /** Distance ridden, metres (keeps growing when wrapping). */
  distanceM = 0
  /** Metres climbed so far. */
  climbedM = 0
  private pos: RoutePosition

  constructor(
    readonly route: Route,
    private physics: PhysicsParams,
    private options: RouteRiderOptions,
  ) {
    this.pos = routeAt(route, 0)
  }

  get position(): RoutePosition {
    return this.pos
  }

  /** True once a non-wrapping route's end is reached. */
  get finished(): boolean {
    return !this.options.wrap && this.distanceM >= this.route.distanceM
  }

  get remainingM(): number {
    return this.options.wrap
      ? this.route.distanceM - this.pos.d
      : Math.max(0, this.route.distanceM - this.distanceM)
  }

  /** Rides `dtS` seconds at `powerW`. */
  step(powerW: number, dtS: number): void {
    if (this.finished || dtS <= 0) return
    const before = this.speedMps
    this.speedMps = stepSpeed(before, powerW, this.pos.gradePct, dtS, this.physics)
    this.distanceM += ((before + this.speedMps) / 2) * dtS
    if (!this.options.wrap) this.distanceM = Math.min(this.distanceM, this.route.distanceM)
    const d = this.options.wrap ? this.distanceM % this.route.distanceM : this.distanceM
    const next = routeAt(this.route, d)
    if (next.ele > this.pos.ele && next.d > this.pos.d) this.climbedM += next.ele - this.pos.ele
    this.pos = next
  }
}

/**
 * The grade sent to the trainer: the road grade scaled by trainer difficulty (0–1), like Zwift,
 * so steep climbs don't need impossible gears. Rounded to 0.1 % to avoid needless commands.
 */
export function trainerGradePct(roadGradePct: number, difficulty: number): number {
  const d = Math.min(1, Math.max(0, difficulty))
  return Math.round(roadGradePct * d * 10) / 10 || 0
}
