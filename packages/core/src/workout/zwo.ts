// Zwift .zwo import (E3-2, DESIGN.md §6.2). .zwo is simple XML; a small tag scanner is enough and
// keeps `core` free of DOM APIs. Text events and unknown elements are ignored.

import { decodeXml as decode } from '../xml'
import type { Workout, WorkoutStep } from './model'

const TAG = /<(\/?)([A-Za-z_][\w-]*)((?:\s+[\w-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g
const ATTR = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

/** `code` lets the UI word the error in its own language (DESIGN.md D21). */
export class ZwoError extends Error {
  constructor(
    readonly code: 'notZwo' | 'notCycling' | 'noSteps',
    message: string,
  ) {
    super(message)
  }
}

/** Parses a .zwo document. `id` becomes the workout id. Throws `ZwoError` if it isn't a workout. */
export function parseZwo(xml: string, id: string): Workout {
  const text = xml.replace(/<!--[\s\S]*?-->/g, '')
  const steps: WorkoutStep[] = []
  const fields: Record<string, string> = {}
  let inWorkout = false
  let depth = 0
  let sawWorkout = false
  let fieldStart: { name: string; end: number } | undefined

  for (const m of text.matchAll(TAG)) {
    const [, closing, rawName, rawAttrs, selfClosing] = m
    const name = rawName!.toLowerCase()
    const end = m.index + m[0].length

    if (name === 'workout') {
      inWorkout = !closing
      sawWorkout ||= inWorkout
      depth = 0
      continue
    }

    if (inWorkout) {
      if (closing) {
        depth--
      } else {
        // Only direct children of <workout> are steps; <textevent> etc. inside them are not.
        if (depth === 0) {
          const step = toStep(name, attrs(rawAttrs ?? ''))
          if (step) steps.push(step)
        }
        if (!selfClosing) depth++
      }
      continue
    }

    if (['name', 'description', 'sporttype', 'category'].includes(name)) {
      if (!closing && !selfClosing) fieldStart = { name, end }
      else if (closing && fieldStart?.name === name) {
        fields[name] = decode(text.slice(fieldStart.end, m.index).trim())
        fieldStart = undefined
      }
    }
  }

  if (!sawWorkout) throw new ZwoError('notZwo', 'not a .zwo workout: no <workout> element')
  if (fields['sporttype'] && fields['sporttype'] !== 'bike') {
    throw new ZwoError('notCycling', `not a cycling workout (sportType ${fields['sporttype']})`)
  }
  if (steps.length === 0) throw new ZwoError('noSteps', 'workout has no steps')

  return {
    id,
    name: fields['name'] || 'Imported workout',
    description: fields['description'] || undefined,
    type: fields['category']?.toLowerCase() || undefined,
    source: 'zwo',
    steps,
  }
}

function toStep(name: string, a: Record<string, string>): WorkoutStep | undefined {
  const num = (key: string): number | undefined => {
    const v = a[key.toLowerCase()]
    const n = v === undefined ? NaN : Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  const durationS = num('Duration') ?? 0
  const cadence = num('Cadence')
  const low = num('PowerLow')
  const high = num('PowerHigh')

  switch (name) {
    case 'warmup':
    case 'ramp':
    case 'cooldown': {
      const from = low ?? num('Power') ?? 0.5
      const to = high ?? from
      // Zwift draws cooldowns going down whichever way round the attributes are written.
      const [fromPct, toPct] =
        name === 'cooldown' ? [Math.max(from, to), Math.min(from, to)] : [from, to]
      return { kind: 'ramp', durationS, fromPct, toPct, cadence }
    }
    case 'steadystate':
    case 'solidstate': {
      const pct = num('Power') ?? (low !== undefined && high !== undefined ? (low + high) / 2 : low)
      return pct === undefined ? undefined : { kind: 'steady', durationS, pct, cadence }
    }
    case 'intervalst': {
      const count = Math.max(1, Math.round(num('Repeat') ?? 1))
      const onPct = num('OnPower') ?? num('PowerOnHigh') ?? num('PowerOnLow') ?? 1
      const offPct = num('OffPower') ?? num('PowerOffLow') ?? num('PowerOffHigh') ?? 0.5
      return {
        kind: 'repeat',
        count,
        steps: [
          { kind: 'steady', durationS: num('OnDuration') ?? 60, pct: onPct, cadence },
          {
            kind: 'steady',
            durationS: num('OffDuration') ?? 60,
            pct: offPct,
            cadence: num('CadenceResting'),
          },
        ],
      }
    }
    case 'freeride':
      return { kind: 'freeride', durationS }
    case 'maxeffort':
      return { kind: 'maxeffort', durationS }
    default:
      return undefined
  }
}

function attrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of raw.matchAll(ATTR)) out[m[1]!.toLowerCase()] = decode(m[2] ?? m[3] ?? '')
  return out
}
