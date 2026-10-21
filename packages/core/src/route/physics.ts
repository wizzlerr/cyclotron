// Cycling physics (E13-3, DESIGN.md D16): speed on a virtual road from power, grade and mass.
// Standard model: rolling resistance + gravity + air drag, with the bike's momentum, so speed
// carries over crests and builds on descents instead of jumping.

export interface PhysicsParams {
  /** Rider + bike, kg. */
  massKg: number
  /** Drag area, m² (≈0.32 on the hoods, ≈0.25 in the drops). */
  cdaM2: number
  /** Rolling resistance coefficient (≈0.004 on good asphalt). */
  crr: number
  /** Air density, kg/m³ (sea level, 15 °C). */
  rhoKgM3: number
  /** Share of pedal power reaching the wheel. */
  drivetrainEff: number
}

export const DEFAULT_PHYSICS: Omit<PhysicsParams, 'massKg'> = {
  cdaM2: 0.32,
  crr: 0.004,
  rhoKgM3: 1.225,
  drivetrainEff: 0.97,
}

const G = 9.80665
const MAX_SPEED_MPS = 30
/** Below this speed, pedal force is capped as if moving at it (standing starts stay finite). */
const MIN_FORCE_SPEED_MPS = 1
/** Integration step for `stepSpeed`, seconds. */
const SUBSTEP_S = 0.1

/** Forces against the rider at speed `v` (m/s) on `gradePct`, newtons. Negative downhill. */
export function resistanceN(v: number, gradePct: number, p: PhysicsParams): number {
  const theta = Math.atan(gradePct / 100)
  const rolling = p.massKg * G * p.crr * Math.cos(theta)
  const gravity = p.massKg * G * Math.sin(theta)
  const aero = 0.5 * p.rhoKgM3 * p.cdaM2 * v * v
  return rolling + gravity + aero
}

/** Speed (m/s) at which `powerW` exactly balances the resistance: the speed you'd settle at. */
export function steadySpeed(powerW: number, gradePct: number, p: PhysicsParams): number {
  const wheelW = Math.max(0, powerW) * p.drivetrainEff
  // Net power available at speed v; decreasing in v once moving, so bisection works.
  const surplus = (v: number): number => wheelW - resistanceN(v, gradePct, p) * v
  if (surplus(0.01) <= 0 && resistanceN(0, gradePct, p) >= 0) return 0
  let lo = 0
  let hi = MAX_SPEED_MPS
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (surplus(mid) > 0) lo = mid
    else hi = mid
  }
  return lo
}

/** Advances speed `v` (m/s) by `dtS` seconds of riding at `powerW` on `gradePct`. */
export function stepSpeed(
  v: number,
  powerW: number,
  gradePct: number,
  dtS: number,
  p: PhysicsParams,
): number {
  const wheelW = Math.max(0, powerW) * p.drivetrainEff
  let speed = Math.max(0, v)
  for (let left = Math.max(0, dtS); left > 1e-9; left -= SUBSTEP_S) {
    const dt = Math.min(SUBSTEP_S, left)
    const drive = wheelW / Math.max(speed, MIN_FORCE_SPEED_MPS)
    const accel = (drive - resistanceN(speed, gradePct, p)) / p.massKg
    speed = Math.min(MAX_SPEED_MPS, Math.max(0, speed + accel * dt))
  }
  return speed
}
