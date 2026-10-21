import { describe, expect, it } from 'vitest'
import {
  analyzeFtpTest,
  bestAverage,
  buildTimeline,
  RAMP_TEST,
  RampFailureDetector,
  TWENTY_MIN_TEST,
  WorkoutPlayer,
  workoutStats,
  type RideSample,
} from '../src'

describe('bestAverage', () => {
  it('finds the best window', () => {
    expect(bestAverage([100, 100, 300, 300, 100], 2)).toBe(300)
    expect(bestAverage([100, 200], 3)).toBeUndefined()
  })
})

/** Rides `workout` on a perfect ERG rider until `stopAtS`, holding `maxEffortW` when there's no target. */
function simulate(workout: typeof RAMP_TEST, ftpW: number, stopAtS: number, maxEffortW = 0) {
  const player = new WorkoutPlayer(workout, ftpW)
  player.start()
  const samples: RideSample[] = []
  for (let t = 1; t <= stopAtS; t++) {
    player.advance(1)
    const s = player.state()
    if (s.status === 'finished') break
    samples.push({ t, powerW: s.targetW ?? maxEffortW, segment: s.segment?.index })
  }
  return samples
}

describe('ramp test', () => {
  it('is 1-minute steps of +6 % from 50 %', () => {
    const effort = buildTimeline(RAMP_TEST.steps).filter((s) => s.effort)
    expect(effort).toHaveLength(25)
    expect(effort.slice(0, 3).map((s) => [s.durationS, s.toPct])).toEqual([
      [60, 0.5],
      [60, 0.56],
      [60, 0.62],
    ])
  })

  it('gives 75 % of the best minute', () => {
    // FTP 200: warm-up 5 min, then fail during the minute at 50 % + 6 % × 13 = 128 % (256 W).
    const samples = simulate(RAMP_TEST, 200, 300 + 13 * 60 + 30)
    const r = analyzeFtpTest(RAMP_TEST, samples)
    // Best rolling minute: 30 s of the 122 % step (244 W) + 30 s at 128 % (256 W) = 250 W → 188.
    expect(r).toEqual({ ok: true, kind: 'ramp', basisW: 250, ftpW: 188 })
  })

  it('needs at least a minute of ramp', () => {
    const r = analyzeFtpTest(RAMP_TEST, simulate(RAMP_TEST, 200, 320))
    expect(r.ok).toBe(false)
  })
})

describe('20-minute test', () => {
  it('gives 95 % of the 20-minute average, ignoring the 5-minute effort', () => {
    const all = simulate(TWENTY_MIN_TEST, 200, 99_999, 260)
    expect(analyzeFtpTest(TWENTY_MIN_TEST, all)).toEqual({
      ok: true,
      kind: '20min',
      basisW: 260,
      ftpW: 247,
    })
    expect(workoutStats(TWENTY_MIN_TEST).durationS).toBe(61 * 60)
  })

  it('refuses a shortened effort', () => {
    // Stop 10 minutes into the 20-minute effort (it starts at 31 min).
    const r = analyzeFtpTest(TWENTY_MIN_TEST, simulate(TWENTY_MIN_TEST, 200, 41 * 60, 260))
    expect(r).toMatchObject({ ok: false })
  })
})

describe('RampFailureDetector', () => {
  it('fires after 10 s under 80 % of target', () => {
    const d = new RampFailureDetector()
    for (let i = 0; i < 9; i++)
      expect(d.update({ powerW: 150, cadenceRpm: 80, targetW: 250 })).toBe(false)
    expect(d.update({ powerW: 150, cadenceRpm: 80, targetW: 250 })).toBe(true)
  })

  it('fires after 5 s of low cadence, and resets on recovery', () => {
    const d = new RampFailureDetector()
    for (let i = 0; i < 4; i++) d.update({ powerW: 250, cadenceRpm: 30, targetW: 250 })
    expect(d.update({ powerW: 250, cadenceRpm: 85, targetW: 250 })).toBe(false)
    for (let i = 0; i < 4; i++)
      expect(d.update({ powerW: 250, cadenceRpm: 30, targetW: 250 })).toBe(false)
    expect(d.update({ powerW: 250, cadenceRpm: 30, targetW: 250 })).toBe(true)
  })

  it('ignores samples without a target', () => {
    const d = new RampFailureDetector()
    for (let i = 0; i < 20; i++) expect(d.update({ powerW: 0, cadenceRpm: 0 })).toBe(false)
  })
})

describe('WorkoutPlayer.skipTo', () => {
  it('jumps forward to a segment', () => {
    const p = new WorkoutPlayer(RAMP_TEST, 200)
    p.start()
    p.advance(400)
    const cooldown = p.timeline.length - 1
    p.skipTo(cooldown)
    expect(p.state()).toMatchObject({ segment: { index: cooldown }, targetW: 100 })
    p.skipTo(0) // never backwards
    expect(p.state().segment?.index).toBe(cooldown)
  })
})
