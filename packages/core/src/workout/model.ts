// Workout format (E3-1, DESIGN.md §6.1). Targets are fractions of FTP, so a workout scales to any
// rider.

export type WorkoutStep =
  | { kind: 'steady'; durationS: number; pct: number; cadence?: number }
  | { kind: 'ramp'; durationS: number; fromPct: number; toPct: number; cadence?: number }
  | { kind: 'repeat'; count: number; steps: WorkoutStep[] }
  /** No ERG; the rider chooses the effort. Optional simulated grade. */
  | { kind: 'freeride'; durationS: number; gradePct?: number }
  /** No ERG; all-out effort (used in tests). */
  | { kind: 'maxeffort'; durationS: number }

export interface Workout {
  id: string
  name: string
  /** e.g. "endurance", "sweetspot", "vo2max". */
  type?: string
  description?: string
  /** Where it came from, e.g. "builtin" or "zwo". */
  source?: string
  steps: WorkoutStep[]
}

/** A flat, playable piece of a workout. Repeats are expanded. */
export interface Segment {
  index: number
  startS: number
  durationS: number
  kind: 'steady' | 'ramp' | 'freeride' | 'maxeffort'
  /** Target at the start/end of the segment as a fraction of FTP; 0 when there is no target. */
  fromPct: number
  toPct: number
  cadence?: number
  gradePct?: number
  /** Position within a repeat block, e.g. 2 of 3. */
  repeat?: { index: number; count: number }
}

export function hasTarget(segment: Segment): boolean {
  return segment.kind === 'steady' || segment.kind === 'ramp'
}

/** Target as a fraction of FTP `offsetS` seconds into the segment (linear for ramps). */
export function segmentPctAt(segment: Segment, offsetS: number): number {
  if (segment.durationS <= 0) return segment.toPct
  const f = Math.min(1, Math.max(0, offsetS / segment.durationS))
  return segment.fromPct + (segment.toPct - segment.fromPct) * f
}

/** Expands repeats into a flat list of segments with start times. */
export function buildTimeline(steps: readonly WorkoutStep[]): Segment[] {
  const out: Segment[] = []
  let t = 0
  const add = (s: Omit<Segment, 'index' | 'startS'>): void => {
    if (s.durationS <= 0) return
    out.push({ index: out.length, startS: t, ...s })
    t += s.durationS
  }
  const walk = (list: readonly WorkoutStep[], repeat?: Segment['repeat']): void => {
    for (const step of list) {
      switch (step.kind) {
        case 'steady':
          add({
            kind: 'steady',
            durationS: step.durationS,
            fromPct: step.pct,
            toPct: step.pct,
            cadence: step.cadence,
            repeat,
          })
          break
        case 'ramp':
          add({
            kind: 'ramp',
            durationS: step.durationS,
            fromPct: step.fromPct,
            toPct: step.toPct,
            cadence: step.cadence,
            repeat,
          })
          break
        case 'freeride':
          add({
            kind: 'freeride',
            durationS: step.durationS,
            fromPct: 0,
            toPct: 0,
            gradePct: step.gradePct,
            repeat,
          })
          break
        case 'maxeffort':
          add({ kind: 'maxeffort', durationS: step.durationS, fromPct: 0, toPct: 0, repeat })
          break
        case 'repeat':
          for (let i = 0; i < step.count; i++) walk(step.steps, { index: i + 1, count: step.count })
          break
      }
    }
  }
  walk(steps)
  return out
}

export function timelineDurationS(timeline: readonly Segment[]): number {
  const last = timeline.at(-1)
  return last ? last.startS + last.durationS : 0
}
