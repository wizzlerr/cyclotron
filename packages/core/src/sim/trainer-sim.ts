// Simulated rider + trainer for development without hardware (E1-6, DESIGN.md §4.2).
// Pure: the caller supplies elapsed time and the random source.

import type { Rng } from './random'

/** What the app asks the trainer to do. Shared by the simulated and the real (FTMS) trainer. */
export type TrainerControl =
  | { kind: 'free' }
  | { kind: 'erg'; watts: number }
  | { kind: 'simulation'; gradePct: number }
  | { kind: 'resistance'; level: number }

export interface SimConfig {
  ftpW: number
  restHr: number
  maxHr: number
  /** Power the virtual rider chooses when not in ERG. */
  freeRideW: number
  /** Time constant for power following the target (ERG response), seconds. */
  powerTauS: number
  /** Time constant for heart rate following effort, seconds. */
  hrTauS: number
  /** Relative power noise, e.g. 0.03 = ±3 %. */
  powerNoise: number
  cadenceRpm: number
  /** The most the virtual rider can push; above it an ERG target can't be held (ramp tests). */
  maxPowerW: number
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  ftpW: 250,
  restHr: 60,
  maxHr: 185,
  freeRideW: 150,
  powerTauS: 2,
  hrTauS: 25,
  powerNoise: 0.03,
  cadenceRpm: 88,
  maxPowerW: 325,
}

export interface SimState {
  /** Smoothed power the rider/trainer is actually producing. */
  basePowerW: number
  heartRateBpm: number
}

export interface SimSample {
  powerW: number
  cadenceRpm: number
  speedKmh: number
  heartRateBpm: number
}

export function initialSimState(cfg: SimConfig = DEFAULT_SIM_CONFIG): SimState {
  return { basePowerW: 0, heartRateBpm: cfg.restHr }
}

/** Power the trainer/rider settles at for a given control. */
export function simTargetPower(
  control: TrainerControl,
  cfg: SimConfig = DEFAULT_SIM_CONFIG,
): number {
  switch (control.kind) {
    case 'free':
      return cfg.freeRideW
    case 'erg':
      return Math.max(0, control.watts)
    case 'simulation':
      // Riders push harder uphill and ease off downhill.
      return Math.max(0, cfg.freeRideW * (1 + control.gradePct * 0.08))
    case 'resistance':
      // KICKR resistance level 0–100.
      return cfg.freeRideW * (0.6 + (clamp(control.level, 0, 100) / 100) * 0.8)
  }
}

/** Advances the simulation by `dtS` seconds. */
export function stepSim(
  state: SimState,
  control: TrainerControl,
  dtS: number,
  rng: Rng,
  cfg: SimConfig = DEFAULT_SIM_CONFIG,
): { state: SimState; sample: SimSample } {
  const target = Math.min(simTargetPower(control, cfg), cfg.maxPowerW)
  const basePowerW = approach(state.basePowerW, target, dtS, cfg.powerTauS)

  const effort = clamp(basePowerW / (cfg.ftpW * 1.15), 0, 1)
  const hrTarget = cfg.restHr + (cfg.maxHr - cfg.restHr) * effort
  const heartRateBpm = approach(state.heartRateBpm, hrTarget, dtS, cfg.hrTauS)

  const noise = 1 + cfg.powerNoise * (rng() * 2 - 1)
  return {
    state: { basePowerW, heartRateBpm },
    sample: {
      powerW: Math.max(0, Math.round(basePowerW * noise)),
      cadenceRpm: basePowerW < 1 ? 0 : Math.round(cfg.cadenceRpm + (rng() * 2 - 1) * 3),
      speedKmh: Math.round(flatSpeedKmh(basePowerW) * 100) / 100,
      heartRateBpm: Math.round(heartRateBpm),
    },
  }
}

/** First-order lag: moves `from` toward `to` with time constant `tauS`. */
function approach(from: number, to: number, dtS: number, tauS: number): number {
  return from + (to - from) * (1 - Math.exp(-Math.max(0, dtS) / tauS))
}

/** Rough flat-road speed from power (air drag only, CdA·ρ/2 ≈ 0.196). */
function flatSpeedKmh(powerW: number): number {
  return Math.cbrt(Math.max(0, powerW) / 0.196) * 3.6
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
