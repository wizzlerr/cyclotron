import type { Workout } from './model'

const min = (m: number): number => m * 60

/** A small starter library until the recommended-workout catalogue exists (E10/E11). */
export const BUILTIN_WORKOUTS: readonly Workout[] = [
  {
    id: 'builtin.recovery.30',
    name: 'Recovery Spin',
    type: 'recovery',
    description: 'Thirty easy minutes to loosen the legs.',
    source: 'builtin',
    steps: [
      { kind: 'ramp', durationS: min(5), fromPct: 0.4, toPct: 0.5 },
      { kind: 'steady', durationS: min(20), pct: 0.5, cadence: 90 },
      { kind: 'ramp', durationS: min(5), fromPct: 0.5, toPct: 0.4 },
    ],
  },
  {
    id: 'builtin.endurance.60',
    name: 'Endurance Hour',
    type: 'endurance',
    description: 'Steady zone 2 with short cadence lifts to stay sharp.',
    source: 'builtin',
    steps: [
      { kind: 'ramp', durationS: min(10), fromPct: 0.45, toPct: 0.65 },
      {
        kind: 'repeat',
        count: 4,
        steps: [
          { kind: 'steady', durationS: min(10), pct: 0.68 },
          { kind: 'steady', durationS: min(1), pct: 0.72, cadence: 105 },
        ],
      },
      { kind: 'steady', durationS: min(6), pct: 0.65 },
      { kind: 'ramp', durationS: min(5), fromPct: 0.6, toPct: 0.4 },
    ],
  },
  {
    id: 'builtin.sweetspot.3x12',
    name: 'Sweet Spot 3×12',
    type: 'sweetspot',
    description: 'Three 12-minute blocks just under threshold.',
    source: 'builtin',
    steps: [
      { kind: 'ramp', durationS: min(10), fromPct: 0.45, toPct: 0.7 },
      {
        kind: 'repeat',
        count: 3,
        steps: [
          { kind: 'steady', durationS: min(12), pct: 0.9, cadence: 90 },
          { kind: 'steady', durationS: min(5), pct: 0.55 },
        ],
      },
      { kind: 'ramp', durationS: min(5), fromPct: 0.6, toPct: 0.4 },
    ],
  },
  {
    id: 'builtin.threshold.2x20',
    name: 'Threshold 2×20',
    type: 'threshold',
    description: 'The classic: two 20-minute efforts at FTP.',
    source: 'builtin',
    steps: [
      { kind: 'ramp', durationS: min(10), fromPct: 0.45, toPct: 0.75 },
      { kind: 'steady', durationS: min(3), pct: 0.55 },
      { kind: 'steady', durationS: min(20), pct: 0.97 },
      { kind: 'steady', durationS: min(8), pct: 0.55 },
      { kind: 'steady', durationS: min(20), pct: 0.97 },
      { kind: 'ramp', durationS: min(8), fromPct: 0.6, toPct: 0.4 },
    ],
  },
  {
    id: 'builtin.vo2max.5x3',
    name: 'VO2max 5×3',
    type: 'vo2max',
    description: 'Five hard 3-minute efforts with equal recovery.',
    source: 'builtin',
    steps: [
      { kind: 'ramp', durationS: min(10), fromPct: 0.45, toPct: 0.75 },
      { kind: 'steady', durationS: 30, pct: 1.1 },
      { kind: 'steady', durationS: min(4.5), pct: 0.5 },
      {
        kind: 'repeat',
        count: 5,
        steps: [
          { kind: 'steady', durationS: min(3), pct: 1.15, cadence: 100 },
          { kind: 'steady', durationS: min(3), pct: 0.5 },
        ],
      },
      { kind: 'ramp', durationS: min(8), fromPct: 0.6, toPct: 0.4 },
    ],
  },
  {
    id: 'builtin.test.short',
    name: 'Player Test',
    type: 'test',
    description: 'Short steps for checking the player and ERG changes.',
    source: 'builtin',
    steps: [
      { kind: 'steady', durationS: 30, pct: 0.5 },
      { kind: 'ramp', durationS: 30, fromPct: 0.5, toPct: 0.8 },
      {
        kind: 'repeat',
        count: 2,
        steps: [
          { kind: 'steady', durationS: 20, pct: 1.0 },
          { kind: 'steady', durationS: 20, pct: 0.6 },
        ],
      },
      { kind: 'freeride', durationS: 30 },
      { kind: 'steady', durationS: 30, pct: 0.5 },
    ],
  },
]
