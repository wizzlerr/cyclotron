// Workout builder support (E3-8): default steps, validation, durations as text and .zwo export.

import type { Workout, WorkoutStep } from './model'

export type StepTemplate =
  'warmup' | 'steady' | 'intervals' | 'ramp' | 'freeride' | 'maxeffort' | 'cooldown'

/** A sensible new step of each kind. */
export function newStep(template: StepTemplate): WorkoutStep {
  switch (template) {
    case 'warmup':
      return { kind: 'ramp', durationS: 600, fromPct: 0.4, toPct: 0.75 }
    case 'steady':
      return { kind: 'steady', durationS: 300, pct: 0.75 }
    case 'intervals':
      return {
        kind: 'repeat',
        count: 5,
        steps: [
          { kind: 'steady', durationS: 180, pct: 1.1 },
          { kind: 'steady', durationS: 120, pct: 0.5 },
        ],
      }
    case 'ramp':
      return { kind: 'ramp', durationS: 300, fromPct: 0.6, toPct: 0.9 }
    case 'freeride':
      return { kind: 'freeride', durationS: 600 }
    case 'maxeffort':
      return { kind: 'maxeffort', durationS: 30 }
    case 'cooldown':
      return { kind: 'ramp', durationS: 600, fromPct: 0.7, toPct: 0.4 }
  }
}

export const MAX_PCT = 3
export const MAX_REPEAT = 50
export const MAX_DURATION_S = 12 * 3600

/**
 * Something that stops a workout from being saved. `path` is the 0-based step position (two
 * entries for a step inside a repeat). The UI words it (core has no language, DESIGN.md D21).
 */
export interface WorkoutProblem {
  code: 'noName' | 'noSteps' | 'repeatCount' | 'emptyRepeat' | 'duration' | 'power'
  path?: number[]
}

/** Problems that stop a workout from being saved; empty when it's fine. */
export function validateWorkout(w: Workout): WorkoutProblem[] {
  const problems: WorkoutProblem[] = []
  if (!w.name.trim()) problems.push({ code: 'noName' })
  if (w.steps.length === 0) problems.push({ code: 'noSteps' })
  const check = (steps: readonly WorkoutStep[], where: number[]): void => {
    steps.forEach((s, i) => {
      const path = [...where, i]
      if (s.kind === 'repeat') {
        if (!Number.isInteger(s.count) || s.count < 1 || s.count > MAX_REPEAT) {
          problems.push({ code: 'repeatCount', path })
        }
        if (s.steps.length === 0) problems.push({ code: 'emptyRepeat', path })
        check(s.steps, path)
        return
      }
      if (!(s.durationS >= 1 && s.durationS <= MAX_DURATION_S)) {
        problems.push({ code: 'duration', path })
      }
      const pcts = s.kind === 'steady' ? [s.pct] : s.kind === 'ramp' ? [s.fromPct, s.toPct] : []
      if (pcts.some((p) => !(p >= 0 && p <= MAX_PCT))) problems.push({ code: 'power', path })
    })
  }
  check(w.steps, [])
  return problems
}

/** "5:00" → 300, "1:30:00" → 5400, "45" → 45 minutes; undefined if it isn't a duration. */
export function parseDuration(text: string): number | undefined {
  const parts = text.trim().split(':')
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return undefined
  const n = parts.map(Number)
  if (n.length === 1) return n[0]! * 60
  if (n.slice(1).some((x) => x >= 60)) return undefined
  return n.length === 2 ? n[0]! * 60 + n[1]! : n[0]! * 3600 + n[1]! * 60 + n[2]!
}

/**
 * The workout as a Zwift .zwo file, which Zwift, TrainerRoad, MyWhoosh and others import.
 * Repeats of exactly two steady steps become IntervalsT; other repeats are written out step by step
 * (.zwo has no general repeat).
 */
export function workoutToZwo(w: Workout): string {
  const lines: string[] = []
  const flat = w.steps.flatMap((s, i) => toZwoSteps(s, i === 0, i === w.steps.length - 1))
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<workout_file>')
  lines.push('    <author>Cyclotron</author>')
  lines.push(`    <name>${xml(w.name)}</name>`)
  lines.push(`    <description>${xml(w.description ?? '')}</description>`)
  lines.push('    <sportType>bike</sportType>')
  if (w.type) lines.push(`    <category>${xml(w.type)}</category>`)
  lines.push('    <workout>')
  for (const s of flat) lines.push(`        ${s}`)
  lines.push('    </workout>')
  lines.push('</workout_file>')
  return lines.join('\n') + '\n'
}

function toZwoSteps(s: WorkoutStep, first: boolean, last: boolean): string[] {
  const cad = (c?: number): string => (c ? ` Cadence="${Math.round(c)}"` : '')
  switch (s.kind) {
    case 'steady':
      return [
        `<SteadyState Duration="${dur(s.durationS)}" Power="${pct(s.pct)}"${cad(s.cadence)}/>`,
      ]
    case 'ramp': {
      const tag =
        first && s.toPct > s.fromPct ? 'Warmup' : last && s.toPct < s.fromPct ? 'Cooldown' : 'Ramp'
      return [
        `<${tag} Duration="${dur(s.durationS)}" PowerLow="${pct(s.fromPct)}" PowerHigh="${pct(s.toPct)}"${cad(s.cadence)}/>`,
      ]
    }
    case 'freeride':
      return [`<FreeRide Duration="${dur(s.durationS)}"/>`]
    case 'maxeffort':
      return [`<MaxEffort Duration="${dur(s.durationS)}"/>`]
    case 'repeat': {
      const [on, off] = s.steps
      if (s.steps.length === 2 && on?.kind === 'steady' && off?.kind === 'steady') {
        const restCad = off.cadence ? ` CadenceResting="${Math.round(off.cadence)}"` : ''
        return [
          `<IntervalsT Repeat="${s.count}" OnDuration="${dur(on.durationS)}" OffDuration="${dur(off.durationS)}" OnPower="${pct(on.pct)}" OffPower="${pct(off.pct)}"${cad(on.cadence)}${restCad}/>`,
        ]
      }
      const once = s.steps.flatMap((x) => toZwoSteps(x, false, false))
      return Array.from({ length: s.count }, () => once).flat()
    }
  }
}

const dur = (s: number): number => Math.round(s)
const pct = (p: number): string => String(Math.round(p * 1000) / 1000)
const xml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
