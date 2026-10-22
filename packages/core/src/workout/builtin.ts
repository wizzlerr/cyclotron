import type { Workout, WorkoutStep } from './model'

// Built-in library (E10-1). Ids are stored with rides, so never rename one.

const min = (m: number): number => m * 60

const warmup = (m = 10, toPct = 0.7): WorkoutStep => ({
  kind: 'ramp',
  durationS: min(m),
  fromPct: 0.45,
  toPct,
})
const cooldown = (m = 5): WorkoutStep => ({
  kind: 'ramp',
  durationS: min(m),
  fromPct: 0.6,
  toPct: 0.4,
})
const steady = (durationS: number, pct: number, cadence?: number): WorkoutStep =>
  cadence ? { kind: 'steady', durationS, pct, cadence } : { kind: 'steady', durationS, pct }
const repeat = (count: number, ...steps: WorkoutStep[]): WorkoutStep => ({
  kind: 'repeat',
  count,
  steps,
})

const workout = (
  id: string,
  name: string,
  type: string,
  description: string,
  steps: WorkoutStep[],
): Workout => ({ id: `builtin.${id}`, name, type, description, source: 'builtin', steps })

export const BUILTIN_WORKOUTS: readonly Workout[] = [
  // Recovery
  workout('recovery.20', 'Easy 20', 'recovery', 'Twenty minutes of gentle spinning.', [
    { kind: 'ramp', durationS: min(3), fromPct: 0.4, toPct: 0.5 },
    steady(min(14), 0.5, 90),
    { kind: 'ramp', durationS: min(3), fromPct: 0.5, toPct: 0.4 },
  ]),
  workout('recovery.30', 'Recovery Spin', 'recovery', 'Thirty easy minutes to loosen the legs.', [
    { kind: 'ramp', durationS: min(5), fromPct: 0.4, toPct: 0.5 },
    steady(min(20), 0.5, 90),
    { kind: 'ramp', durationS: min(5), fromPct: 0.5, toPct: 0.4 },
  ]),
  workout(
    'recovery.45',
    'Recovery Spin-ups',
    'recovery',
    'Easy riding with a fast-cadence minute every few minutes. Keep the power low.',
    [
      { kind: 'ramp', durationS: min(5), fromPct: 0.4, toPct: 0.5 },
      repeat(5, steady(min(6), 0.5, 90), steady(min(1), 0.5, 110)),
      { kind: 'ramp', durationS: min(5), fromPct: 0.5, toPct: 0.4 },
    ],
  ),
  workout('recovery.60', 'Easy Hour', 'recovery', 'A full hour, all of it easy.', [
    { kind: 'ramp', durationS: min(5), fromPct: 0.4, toPct: 0.52 },
    steady(min(50), 0.52, 90),
    { kind: 'ramp', durationS: min(5), fromPct: 0.52, toPct: 0.4 },
  ]),

  // Endurance
  workout('endurance.45', 'Endurance 45', 'endurance', 'A short zone 2 ride.', [
    warmup(8, 0.65),
    steady(min(32), 0.68),
    cooldown(5),
  ]),
  workout(
    'endurance.60',
    'Endurance Hour',
    'endurance',
    'Steady zone 2 with short cadence lifts to stay sharp.',
    [
      warmup(10, 0.65),
      repeat(4, steady(min(10), 0.68), steady(min(1), 0.72, 105)),
      steady(min(6), 0.65),
      cooldown(5),
    ],
  ),
  workout(
    'endurance.cadence',
    'Cadence Builder',
    'endurance',
    'Zone 2 with cadence steps from 85 up to 115 rpm. Same power, faster legs.',
    [
      warmup(10, 0.65),
      repeat(6, steady(min(5), 0.65, 85), steady(min(2), 0.65, 105), steady(min(1), 0.65, 115)),
      steady(min(7), 0.65),
      cooldown(5),
    ],
  ),
  workout(
    'endurance.75',
    'Endurance with Tempo',
    'endurance',
    'Zone 2 with three 5-minute tempo touches.',
    [warmup(10, 0.65), repeat(3, steady(min(15), 0.68), steady(min(5), 0.8)), cooldown(5)],
  ),
  workout(
    'endurance.bursts',
    'Endurance with Bursts',
    'endurance',
    'An hour of zone 2 with a 10-second burst every ten minutes.',
    [
      warmup(10, 0.65),
      repeat(6, steady(570, 0.68), steady(10, 1.5, 100), steady(20, 0.55)),
      cooldown(5),
    ],
  ),
  workout('endurance.90', 'Endurance 90', 'endurance', 'Ninety minutes of steady zone 2.', [
    warmup(10, 0.65),
    repeat(3, steady(min(20), 0.66), steady(min(5), 0.72)),
    cooldown(5),
  ]),
  workout(
    'endurance.120',
    'Long Endurance',
    'endurance',
    'Two hours in zone 2 with a few short lifts.',
    [warmup(10, 0.65), repeat(4, steady(min(22), 0.68), steady(min(3), 0.75, 100)), cooldown(10)],
  ),
  workout('endurance.180', 'Endurance 3h', 'endurance', 'The long one. Eat and drink as you go.', [
    warmup(10, 0.65),
    repeat(5, steady(min(30), 0.66), steady(min(3), 0.72)),
    cooldown(5),
  ]),

  // Tempo
  workout('tempo.3x10', 'Tempo 3×10', 'tempo', 'Three 10-minute blocks at a firm, steady pace.', [
    warmup(),
    repeat(3, steady(min(10), 0.83), steady(min(5), 0.6)),
    cooldown(),
  ]),
  workout('tempo.2x20', 'Tempo 2×20', 'tempo', 'Two 20-minute tempo blocks.', [
    warmup(),
    steady(min(20), 0.82),
    steady(min(5), 0.6),
    steady(min(20), 0.82),
    cooldown(),
  ]),
  workout('tempo.45', 'Tempo 45', 'tempo', 'One unbroken 45-minute tempo block.', [
    warmup(),
    steady(min(45), 0.8, 90),
    cooldown(),
  ]),
  workout(
    'tempo.cadence',
    'Tempo Cadence Pyramid',
    'tempo',
    'Two 25-minute tempo blocks, cadence stepping 80 → 100 → 80 rpm.',
    [
      warmup(),
      repeat(
        2,
        steady(min(5), 0.82, 80),
        steady(min(5), 0.82, 90),
        steady(min(5), 0.82, 100),
        steady(min(5), 0.82, 90),
        steady(min(5), 0.82, 80),
        steady(min(5), 0.6),
      ),
      cooldown(),
    ],
  ),
  workout('tempo.3x20', 'Tempo 3×20', 'tempo', 'Three 20-minute tempo blocks: a big aerobic day.', [
    warmup(),
    repeat(3, steady(min(20), 0.8), steady(min(5), 0.6)),
    cooldown(),
  ]),

  // Sweet spot
  workout(
    'sweetspot.4x8',
    'Sweet Spot Express',
    'sweetspot',
    'Four 8-minute sweet spot efforts in under an hour.',
    [warmup(8), repeat(4, steady(min(8), 0.9), steady(min(3), 0.55)), cooldown(4)],
  ),
  workout('sweetspot.2x15', 'Sweet Spot 2×15', 'sweetspot', 'Two 15-minute sweet spot efforts.', [
    warmup(),
    repeat(2, steady(min(15), 0.9), steady(min(5), 0.55)),
    cooldown(),
  ]),
  workout(
    'sweetspot.3x12',
    'Sweet Spot 3×12',
    'sweetspot',
    'Three 12-minute blocks just under threshold.',
    [warmup(), repeat(3, steady(min(12), 0.9, 90), steady(min(5), 0.55)), cooldown()],
  ),
  workout('sweetspot.4x10', 'Sweet Spot 4×10', 'sweetspot', 'Four 10-minute sweet spot efforts.', [
    warmup(),
    repeat(4, steady(min(10), 0.9), steady(min(4), 0.55)),
    cooldown(),
  ]),
  workout(
    'sweetspot.surges',
    'Sweet Spot Surges',
    'sweetspot',
    'Sweet spot blocks with a 30-second lift to FTP every three minutes.',
    [
      warmup(),
      repeat(3, repeat(4, steady(150, 0.88), steady(30, 1.0)), steady(min(5), 0.55)),
      cooldown(),
    ],
  ),
  workout('sweetspot.2x20', 'Sweet Spot 2×20', 'sweetspot', 'Two 20-minute sweet spot efforts.', [
    warmup(),
    steady(min(20), 0.9),
    steady(min(5), 0.55),
    steady(min(20), 0.9),
    cooldown(),
  ]),
  workout('sweetspot.3x15', 'Sweet Spot 3×15', 'sweetspot', 'Three 15-minute sweet spot efforts.', [
    warmup(),
    repeat(3, steady(min(15), 0.91), steady(min(5), 0.55)),
    cooldown(),
  ]),
  workout('sweetspot.45', 'Sweet Spot 45', 'sweetspot', 'One 45-minute sweet spot block.', [
    warmup(),
    steady(min(45), 0.89),
    cooldown(10),
  ]),
  workout(
    'sweetspot.3x20',
    'Sweet Spot 3×20',
    'sweetspot',
    'Three 20-minute efforts at the top of sweet spot.',
    [warmup(), repeat(3, steady(min(20), 0.92), steady(min(5), 0.55)), cooldown()],
  ),

  // Threshold
  workout('threshold.3x10', 'Threshold 3×10', 'threshold', 'Three 10-minute efforts at FTP.', [
    warmup(10, 0.75),
    repeat(3, steady(min(10), 0.98), steady(min(5), 0.55)),
    cooldown(),
  ]),
  workout(
    'threshold.overunders',
    'Over-Unders',
    'threshold',
    'Three 9-minute blocks switching between just under and just over FTP.',
    [
      warmup(10, 0.75),
      repeat(3, repeat(3, steady(min(2), 0.95), steady(min(1), 1.05)), steady(min(5), 0.55)),
      cooldown(),
    ],
  ),
  workout(
    'threshold.5x6',
    'Threshold 5×6',
    'threshold',
    'Five 6-minute efforts slightly over FTP.',
    [warmup(10, 0.75), repeat(5, steady(min(6), 1.02), steady(min(3), 0.55)), cooldown()],
  ),
  workout('threshold.2x15', 'Threshold 2×15', 'threshold', 'Two 15-minute efforts at FTP.', [
    warmup(10, 0.75),
    repeat(2, steady(min(15), 0.97), steady(min(6), 0.55)),
    cooldown(),
  ]),
  workout('threshold.4x8', 'Threshold 4×8', 'threshold', 'Four 8-minute efforts right at FTP.', [
    warmup(10, 0.75),
    repeat(4, steady(min(8), 1.0), steady(min(4), 0.55)),
    cooldown(),
  ]),
  workout(
    'threshold.2x20',
    'Threshold 2×20',
    'threshold',
    'The classic: two 20-minute efforts at FTP.',
    [
      warmup(10, 0.75),
      steady(min(3), 0.55),
      steady(min(20), 0.97),
      steady(min(8), 0.55),
      steady(min(20), 0.97),
      { kind: 'ramp', durationS: min(8), fromPct: 0.6, toPct: 0.4 },
    ],
  ),
  workout('threshold.3x15', 'Threshold 3×15', 'threshold', 'Three 15-minute efforts at FTP.', [
    warmup(10, 0.75),
    repeat(3, steady(min(15), 0.97), steady(min(6), 0.55)),
    cooldown(),
  ]),
  workout('threshold.40', 'Threshold 40', 'threshold', 'Forty unbroken minutes at FTP.', [
    warmup(12, 0.75),
    steady(min(40), 0.96),
    cooldown(8),
  ]),

  // VO2max
  workout(
    'vo2max.40-20',
    '40/20s',
    'vo2max',
    'Two sets of eight 40-second efforts with 20 seconds easy.',
    [
      warmup(10, 0.75),
      repeat(2, repeat(8, steady(40, 1.2, 100), steady(20, 0.5)), steady(min(6), 0.5)),
      cooldown(),
    ],
  ),
  workout(
    'vo2max.30-30',
    '30/30s',
    'vo2max',
    'Two sets of ten 30-second efforts with 30 seconds easy.',
    [
      warmup(10, 0.75),
      repeat(2, repeat(10, steady(30, 1.2, 100), steady(30, 0.5)), steady(min(5), 0.5)),
      cooldown(),
    ],
  ),
  workout('vo2max.4x4', 'VO2max 4×4', 'vo2max', 'Four 4-minute efforts with equal recovery.', [
    warmup(10, 0.75),
    steady(30, 1.1),
    steady(min(4.5), 0.5),
    repeat(4, steady(min(4), 1.12, 100), steady(min(4), 0.5)),
    cooldown(),
  ]),
  workout('vo2max.8x2', 'VO2max 8×2', 'vo2max', 'Eight 2-minute efforts with equal recovery.', [
    warmup(10, 0.75),
    repeat(8, steady(min(2), 1.18, 100), steady(min(2), 0.5)),
    cooldown(6),
  ]),
  workout('vo2max.3x6', 'Long VO2 3×6', 'vo2max', 'Three long 6-minute efforts just above FTP.', [
    warmup(12, 0.75),
    repeat(3, steady(min(6), 1.08), steady(min(5), 0.5)),
    cooldown(8),
  ]),
  workout('vo2max.5x3', 'VO2max 5×3', 'vo2max', 'Five hard 3-minute efforts with equal recovery.', [
    warmup(10, 0.75),
    steady(30, 1.1),
    steady(min(4.5), 0.5),
    repeat(5, steady(min(3), 1.15, 100), steady(min(3), 0.5)),
    { kind: 'ramp', durationS: min(8), fromPct: 0.6, toPct: 0.4 },
  ]),
  workout('vo2max.6x3', 'VO2max 6×3', 'vo2max', 'Six hard 3-minute efforts with equal recovery.', [
    warmup(10, 0.75),
    repeat(6, steady(min(3), 1.15, 100), steady(min(3), 0.5)),
    cooldown(8),
  ]),
  workout('vo2max.5x4', 'VO2max 5×4', 'vo2max', 'Five 4-minute efforts with equal recovery.', [
    warmup(10, 0.75),
    repeat(5, steady(min(4), 1.13, 100), steady(min(4), 0.5)),
    cooldown(6),
  ]),

  // Anaerobic
  workout(
    'anaerobic.sprints',
    'Sprint Session',
    'anaerobic',
    'Eight 20-second sprints with long recoveries. Go all in on each one.',
    [warmup(15, 0.75), repeat(8, steady(20, 1.75, 110), steady(280, 0.55)), cooldown()],
  ),
  workout(
    'anaerobic.tabata',
    'Tabata Sets',
    'anaerobic',
    'Two sets of eight 20-second efforts with 10 seconds rest.',
    [
      warmup(12, 0.75),
      repeat(2, repeat(8, steady(20, 1.7, 105), steady(10, 0.4)), steady(min(6), 0.5)),
      cooldown(6),
    ],
  ),
  workout(
    'anaerobic.10x30',
    '30-Second Blasts',
    'anaerobic',
    'Ten 30-second efforts well above VO2max.',
    [warmup(12, 0.75), repeat(10, steady(30, 1.5, 105), steady(150, 0.5)), cooldown(6)],
  ),
  workout(
    'anaerobic.5x90',
    'Anaerobic 5×90 s',
    'anaerobic',
    'Five 90-second efforts. The last 30 seconds of each will hurt.',
    [warmup(12, 0.75), repeat(5, steady(90, 1.25), steady(270, 0.5)), cooldown(6)],
  ),
  workout('anaerobic.8x1', 'Anaerobic 8×1', 'anaerobic', 'Eight 1-minute efforts at 130 %.', [
    warmup(12, 0.75),
    repeat(8, steady(min(1), 1.3, 100), steady(min(3), 0.5)),
    cooldown(6),
  ]),
]

/** Short steps for checking the player and ERG changes (Settings → Developer). */
export const PLAYER_TEST_WORKOUT: Workout = {
  id: 'builtin.test.short',
  name: 'Player Test',
  type: 'demo',
  description: 'Short steps for checking the player and ERG changes.',
  source: 'builtin',
  steps: [
    { kind: 'steady', durationS: 30, pct: 0.5 },
    { kind: 'ramp', durationS: 30, fromPct: 0.5, toPct: 0.8 },
    repeat(2, steady(20, 1.0), steady(20, 0.6)),
    { kind: 'freeride', durationS: 30 },
    { kind: 'steady', durationS: 30, pct: 0.5 },
  ],
}

export const FREE_RIDE_ID = 'freeride'

/** A ride without a plan: one long free-ride step. Not listed in the library. */
export const FREE_RIDE_WORKOUT: Workout = {
  id: FREE_RIDE_ID,
  name: 'Free ride',
  source: 'builtin',
  steps: [{ kind: 'freeride', durationS: 6 * 3600 }],
}
