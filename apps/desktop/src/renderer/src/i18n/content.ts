// Names and descriptions of built-in content in the UI language (E15-4), and of workouts made to
// measure (E11-10), which are worded from their id.
import {
  buildTimeline,
  parseGeneratedId,
  timelineDurationS,
  type GenSpec,
  type Route,
  type Workout,
} from '@cyclotron/core'
import { formatNumber } from './i18n.svelte'
import { t } from './t'

export function workoutName(w: Workout): string {
  const spec = parseGeneratedId(w.id)
  if (spec) {
    const type = t().common.workoutTypes[spec.type]
    // Interval workouts are named by their intervals; steady ones by their whole length and power.
    if (spec.count > 1) return `${type} ${spec.count}×${span(spec.onS)}`
    const total = span(timelineDurationS(buildTimeline(w.steps)))
    return `${type} ${total} · ${formatNumber(Math.round(spec.onPct * 100))} %`
  }
  return t().content.workouts[w.id]?.name ?? w.name
}

export function workoutDescription(w: Workout): string | undefined {
  const spec = parseGeneratedId(w.id)
  if (spec) return generatedDescription(spec)
  return t().content.workouts[w.id]?.description ?? w.description
}

function generatedDescription(s: GenSpec): string {
  const g = t().reco.generated
  const pct = formatNumber(Math.round(s.onPct * 100))
  return s.count === 1
    ? g.steady(span(s.onS), pct)
    : g.intervals(s.count, span(s.onS), pct, span(s.offS), s.fillS > 0)
}

/** 30 → "30 s", 600 → "10 min". */
const span = (seconds: number): string =>
  seconds < 60 ? `${seconds} s` : `${formatNumber(Math.round(seconds / 6) / 10)} min`

/** The route's name, plus how it's ridden for a variant, e.g. "Alpe d'Huez (reverse, from km 5)". */
export function routeName(r: Route): string {
  const name = t().content.routes[r.id]?.name ?? r.name
  const v = r.variant
  if (!v) return name
  const fromKm = v.startM > 0 ? formatNumber(v.startM / 1000, 1) : undefined
  return `${name} (${t().library.routeStart.variant(v.reverse, fromKm)})`
}

export const routeDescription = (r: Route): string | undefined =>
  t().content.routes[r.id]?.description ?? r.description
