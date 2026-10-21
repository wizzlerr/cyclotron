import { describe, expect, it } from 'vitest'
import {
  BUILTIN_WORKOUTS,
  buildTimeline,
  normalizedPower,
  segmentPctAt,
  timelineDurationS,
  workoutStats,
  WorkoutPlayer,
  type Workout,
} from '../src'

const workout = (steps: Workout['steps']): Workout => ({ id: 't', name: 'T', steps })

describe('buildTimeline', () => {
  it('expands repeats and assigns start times', () => {
    const tl = buildTimeline([
      { kind: 'steady', durationS: 60, pct: 0.5 },
      {
        kind: 'repeat',
        count: 2,
        steps: [
          { kind: 'steady', durationS: 30, pct: 1.1 },
          { kind: 'steady', durationS: 30, pct: 0.5 },
        ],
      },
      { kind: 'freeride', durationS: 120 },
    ])
    expect(tl.map((s) => [s.startS, s.durationS, s.toPct])).toEqual([
      [0, 60, 0.5],
      [60, 30, 1.1],
      [90, 30, 0.5],
      [120, 30, 1.1],
      [150, 30, 0.5],
      [180, 120, 0],
    ])
    expect(tl[3]!.repeat).toEqual({ index: 2, count: 2 })
    expect(timelineDurationS(tl)).toBe(300)
  })

  it('skips empty steps', () => {
    expect(buildTimeline([{ kind: 'steady', durationS: 0, pct: 1 }])).toEqual([])
  })

  it('interpolates ramps', () => {
    const [ramp] = buildTimeline([{ kind: 'ramp', durationS: 100, fromPct: 0.4, toPct: 0.8 }])
    expect(segmentPctAt(ramp!, 0)).toBeCloseTo(0.4)
    expect(segmentPctAt(ramp!, 50)).toBeCloseTo(0.6)
    expect(segmentPctAt(ramp!, 200)).toBeCloseTo(0.8)
  })
})

describe('normalizedPower and workoutStats', () => {
  it('equals the power for a steady effort', () => {
    expect(normalizedPower(Array<number>(600).fill(200))).toBeCloseTo(200)
    expect(normalizedPower([200])).toBe(0)
  })

  it('gives one hour at FTP 100 TSS', () => {
    const s = workoutStats(workout([{ kind: 'steady', durationS: 3600, pct: 1 }]))
    expect(s.durationS).toBe(3600)
    expect(s.intensity).toBeCloseTo(1)
    expect(s.tss).toBeCloseTo(100)
  })

  it('gives plausible numbers for the built-ins', () => {
    for (const w of BUILTIN_WORKOUTS) {
      const s = workoutStats(w)
      expect(s.intensity, w.id).toBeGreaterThan(0.4)
      expect(s.intensity, w.id).toBeLessThan(1.1)
    }
    const ss = workoutStats(BUILTIN_WORKOUTS.find((w) => w.id === 'builtin.sweetspot.3x12')!)
    expect(ss.durationS).toBe(66 * 60)
    expect(ss.tss).toBeGreaterThan(60)
    expect(ss.tss).toBeLessThan(80)
  })
})

describe('WorkoutPlayer', () => {
  const w = workout([
    { kind: 'steady', durationS: 60, pct: 0.5 },
    { kind: 'ramp', durationS: 100, fromPct: 0.5, toPct: 1.0 },
    { kind: 'freeride', durationS: 30, gradePct: 2 },
    { kind: 'maxeffort', durationS: 10 },
  ])

  it('stays idle until started', () => {
    const p = new WorkoutPlayer(w, 200)
    p.advance(10)
    expect(p.state()).toMatchObject({ status: 'ready', positionS: 0, control: { kind: 'free' } })
  })

  it('computes ERG targets from FTP, ramps and intensity', () => {
    const p = new WorkoutPlayer(w, 200)
    p.start()
    expect(p.state()).toMatchObject({
      targetW: 100,
      segmentRemainingS: 60,
      nextTargetW: 100,
      control: { kind: 'erg', watts: 100 },
    })
    p.advance(110)
    expect(p.state()).toMatchObject({ targetW: 150, segmentElapsedS: 50, segmentRemainingS: 50 })
    p.setIntensity(1.1)
    expect(p.state().targetW).toBe(165)
    p.setIntensity(9)
    expect(p.state().intensity).toBe(1.5)
  })

  it('does not count paused time', () => {
    const p = new WorkoutPlayer(w, 200)
    p.start()
    p.advance(10)
    p.pause()
    p.advance(100)
    expect(p.state()).toMatchObject({ status: 'paused', positionS: 10, control: { kind: 'free' } })
    p.resume()
    p.advance(5)
    expect(p.state().positionS).toBe(15)
  })

  it('switches off ERG for free ride and max effort', () => {
    const p = new WorkoutPlayer(w, 200)
    p.start()
    p.advance(165)
    expect(p.state()).toMatchObject({
      targetW: undefined,
      control: { kind: 'simulation', gradePct: 2 },
      nextTargetW: undefined,
    })
    p.skip()
    expect(p.state()).toMatchObject({ segment: { kind: 'maxeffort' }, control: { kind: 'free' } })
  })

  it('skips to the next segment and finishes at the end', () => {
    const p = new WorkoutPlayer(w, 200)
    p.start()
    p.advance(5)
    p.skip()
    expect(p.state()).toMatchObject({ positionS: 60, segment: { index: 1 } })
    p.advance(1000)
    expect(p.state()).toMatchObject({
      status: 'finished',
      positionS: 200,
      segment: undefined,
      control: { kind: 'free' },
    })
  })
})
