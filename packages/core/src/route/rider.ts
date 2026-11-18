// Progress along a route (E13-4): speed from the physics model, distance, position and climbing.
// Pure; the ride session feeds it power and elapsed time.

import { stepSpeed, type PhysicsParams } from './physics'
import { routeAt, type Route, type RoutePosition } from './route'

export interface RouteRiderOptions {
  /**
   * Keep riding at the end (workouts on a route) instead of stopping: round again on a loop, or
   * turn round and ride back on a point-to-point route.
   */
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

  /** To the end of the route in the direction of travel (the start when riding back). */
  get remainingM(): number {
    if (!this.options.wrap) return Math.max(0, this.route.distanceM - this.distanceM)
    return this.pos.backwards ? this.pos.d : this.route.distanceM - this.pos.d
  }

  /** Puts the rider back where an interrupted ride left off (standing still). */
  placeAt(distanceM: number, climbedM: number): void {
    this.distanceM = Math.max(0, distanceM)
    if (!this.options.wrap) this.distanceM = Math.min(this.distanceM, this.route.distanceM)
    this.climbedM = Math.max(0, climbedM)
    this.speedMps = 0
    this.pos = this.positionAt(this.distanceM)
  }

  /** Rides `dtS` seconds at `powerW`. */
  step(powerW: number, dtS: number): void {
    if (this.finished || dtS <= 0) return
    const before = this.speedMps
    this.speedMps = stepSpeed(before, powerW, this.pos.gradePct, dtS, this.physics)
    const moved = ((before + this.speedMps) / 2) * dtS
    this.distanceM += moved
    if (!this.options.wrap) this.distanceM = Math.min(this.distanceM, this.route.distanceM)
    const next = this.positionAt(this.distanceM)
    // Climbing counts along the road, not across the jump from a loop's end to its start.
    const along = Math.abs(next.d - this.pos.d) <= moved + 1
    if (along && next.ele > this.pos.ele) this.climbedM += next.ele - this.pos.ele
    this.pos = next
  }

  /** Where `distanceM` ridden puts the rider: round a loop again, back and forth otherwise. */
  private positionAt(distanceM: number): RoutePosition {
    const length = this.route.distanceM
    if (!this.options.wrap || distanceM <= length) return routeAt(this.route, distanceM)
    if (this.route.loop) return routeAt(this.route, distanceM % length)
    const m = distanceM % (2 * length)
    if (m <= length) return routeAt(this.route, m)
    const p = routeAt(this.route, 2 * length - m)
    return { ...p, gradePct: -p.gradePct || 0, backwards: true }
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
