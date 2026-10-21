import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SIM_CONFIG,
  initialSimState,
  seededRng,
  simTargetPower,
  stepSim,
  type SimSample,
  type SimState,
  type TrainerControl,
} from '../src'

function run(control: TrainerControl, seconds: number, start: SimState = initialSimState()) {
  const rng = seededRng(42)
  let state = start
  const samples: SimSample[] = []
  for (let i = 0; i < seconds; i++) {
    const r = stepSim(state, control, 1, rng)
    state = r.state
    samples.push(r.sample)
  }
  return { state, samples }
}

describe('rider limit', () => {
  it('cannot hold ERG targets above maxPowerW', () => {
    let state = initialSimState()
    let sample = { powerW: 0 }
    for (let i = 0; i < 60; i++) {
      ;({ state, sample } = stepSim(state, { kind: 'erg', watts: 500 }, 1, () => 0.5))
    }
    expect(sample.powerW).toBe(DEFAULT_SIM_CONFIG.maxPowerW)
  })
})

describe('stepSim', () => {
  it('follows an ERG target with lag', () => {
    const { state, samples } = run({ kind: 'erg', watts: 200 }, 15)
    expect(samples[0]!.powerW).toBeLessThan(100)
    expect(state.basePowerW).toBeCloseTo(200, 0)
  })

  it('keeps power noise within the configured band', () => {
    const { samples } = run({ kind: 'erg', watts: 200 }, 120)
    for (const s of samples.slice(20)) {
      expect(s.powerW).toBeGreaterThanOrEqual(200 * (1 - DEFAULT_SIM_CONFIG.powerNoise) - 1)
      expect(s.powerW).toBeLessThanOrEqual(200 * (1 + DEFAULT_SIM_CONFIG.powerNoise) + 1)
    }
  })

  it('raises heart rate slowly toward an effort-based level, below max', () => {
    const { samples } = run({ kind: 'erg', watts: 300 }, 300)
    expect(samples[10]!.heartRateBpm).toBeLessThan(samples[120]!.heartRateBpm)
    expect(samples.at(-1)!.heartRateBpm).toBeLessThanOrEqual(DEFAULT_SIM_CONFIG.maxHr)
    expect(samples.at(-1)!.heartRateBpm).toBeGreaterThan(165)
  })

  it('is deterministic for a given seed', () => {
    expect(run({ kind: 'free' }, 30).samples).toEqual(run({ kind: 'free' }, 30).samples)
  })

  it('does nothing when no time passes', () => {
    const start = { basePowerW: 120, heartRateBpm: 110 }
    expect(stepSim(start, { kind: 'erg', watts: 300 }, 0, seededRng(1)).state).toEqual(start)
  })

  it('reports zero cadence and speed when stopped', () => {
    const { samples } = run({ kind: 'erg', watts: 0 }, 1)
    expect(samples[0]).toMatchObject({ powerW: 0, cadenceRpm: 0, speedKmh: 0 })
  })
})

describe('simTargetPower', () => {
  it('pushes harder uphill and with more resistance', () => {
    expect(simTargetPower({ kind: 'simulation', gradePct: 5 })).toBeGreaterThan(
      simTargetPower({ kind: 'simulation', gradePct: 0 }),
    )
    expect(simTargetPower({ kind: 'simulation', gradePct: -20 })).toBe(0)
    expect(simTargetPower({ kind: 'resistance', level: 80 })).toBeGreaterThan(
      simTargetPower({ kind: 'resistance', level: 20 }),
    )
  })
})
