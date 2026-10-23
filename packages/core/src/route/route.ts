// Route model (E13-2, DESIGN.md D16). A route is resampled to evenly spaced points so position
// lookups are O(1), and its elevation is smoothed so GPS/DEM noise doesn't become grade spikes.

import type { GpxPoint } from './gpx'

/** Spacing of the resampled points, metres. */
export const ROUTE_STEP_M = 20
/** The rider feels the grade over this stretch, centred on them, not per 20 m segment. */
const GRADE_OVER_M = 100
/** Elevation is averaged over about this many metres (centred). */
const SMOOTH_M = 100
/** Grades beyond this are treated as data errors. */
const MAX_GRADE_PCT = 25
/** Max grade is measured over this distance, like climb databases do. */
const MAX_GRADE_OVER_M = 200
/** Start and end this close make a loop. */
const LOOP_GAP_M = 200

export interface RouteMeta {
  id: string
  name: string
  description?: string
  source: 'builtin' | 'gpx'
  /** Data credit shown with the route, e.g. "© OpenStreetMap contributors". */
  attribution?: string
  /**
   * Steepest believable grade. Elevation models blur steep hillsides beside hairpins into
   * 20–27 % "ramps"; rises above this are spread onto neighbouring stretches instead.
   */
  gradeCapPct?: number
}

export interface RoutePoint {
  lat: number
  lon: number
  /** Smoothed elevation, metres. */
  ele: number
  /** Distance from the start, metres. */
  d: number
}

export interface Route extends RouteMeta {
  /** Every `ROUTE_STEP_M` metres, plus the end point (the last gap is 0.5–1.5 steps). */
  points: RoutePoint[]
  distanceM: number
  ascentM: number
  descentM: number
  /** End elevation minus start elevation over the distance. */
  avgGradePct: number
  /** Steepest 200 m. */
  maxGradePct: number
  loop: boolean
  /** Set on a route ridden backwards or from part-way along (see `routeVariant`). */
  variant?: RouteVariant
}

/** How a route is ridden: backwards, and/or starting `startM` metres in (in that direction). */
export interface RouteVariant {
  reverse: boolean
  startM: number
}

export interface RoutePosition {
  lat: number
  lon: number
  ele: number
  gradePct: number
  /** Distance along the route, clamped to [0, distanceM]. */
  d: number
}

/** Builds a route from raw points (GPX or built-in data). Throws if it has no length. */
export function buildRoute(meta: RouteMeta, raw: readonly GpxPoint[]): Route {
  // Cumulative distance along the raw points, skipping repeats (GPS standing still).
  const pts: { lat: number; lon: number; ele: number; d: number }[] = []
  for (const p of raw) {
    const prev = pts.at(-1)
    const d = prev ? prev.d + haversineM(prev, p) : 0
    if (prev && d - prev.d < 0.5) continue
    pts.push({ lat: p.lat, lon: p.lon, ele: p.ele ?? prev?.ele ?? 0, d })
  }
  const distanceM = pts.at(-1)?.d ?? 0
  if (pts.length < 2 || distanceM < ROUTE_STEP_M) throw new RangeError('route is too short')

  const resampled = resample(pts, 0, distanceM)

  const half = Math.round(SMOOTH_M / ROUTE_STEP_M / 2)
  const ele = smooth(
    resampled.map((p) => p.ele),
    half,
  )
  // Capping leaves neighbouring segments alternating at and below the cap; smoothing again evens
  // them out without exceeding it (an average of capped grades can't be steeper).
  const capped = meta.gradeCapPct
    ? smooth(limitGrades(ele, resampled, meta.gradeCapPct), half)
    : ele
  const points = resampled.map((p, i) => ({ ...p, ele: round1(capped[i]!) }))
  return summarize(meta, points, distanceM)
}

/**
 * The same road ridden backwards and/or from part-way along. A loop started part-way goes all
 * the way round (back to where it started); any other route is cut short. Elevation is already
 * smoothed, so the points are only re-spaced, not smoothed again.
 */
export function routeVariant(route: Route, variant: RouteVariant): Route {
  const base = route.variant ? undefined : route
  if (!base) throw new RangeError('route is already a variant')
  const maxStart = Math.max(0, base.distanceM - MIN_VARIANT_M)
  const startM = Math.min(maxStart, Math.max(0, Math.round(variant.startM)))
  if (!variant.reverse && startM === 0) return base

  let path: RoutePoint[] = variant.reverse
    ? base.points.map((p) => ({ ...p, d: base.distanceM - p.d })).reverse()
    : base.points
  const from = startM
  let to = base.distanceM
  if (startM > 0 && base.loop) {
    // Round the loop: the rest of it, the gap from finish to start, then the part skipped.
    const end = path.at(-1)!
    const gap = haversineM(end, path[0]!)
    const tail = path
      .filter((p) => p.d < startM + ROUTE_STEP_M)
      .map((p) => ({ ...p, d: p.d + end.d + gap }))
    path = [...path, ...(gap < 0.5 ? tail.slice(1) : tail)]
    to = startM + end.d + gap
  }
  const resampled = resample(path, from, to).map((p) => ({ ...p, d: p.d - from }))
  const points = resampled.map((p) => ({ ...p, ele: round1(p.ele) }))
  return {
    ...summarize(base, points, to - startM),
    loop: base.loop,
    variant: { reverse: variant.reverse, startM },
  }
}

/** A variant leaves at least this much road to ride. */
export const MIN_VARIANT_M = 1000

/** Stable id of a route as ridden, e.g. `alpe-dhuez?reverse&start=5000` (stored with rides). */
export function routeKey(route: Route): string {
  const v = route.variant
  if (!v) return route.id
  const params = [v.reverse ? 'reverse' : '', v.startM > 0 ? `start=${v.startM}` : '']
  return `${route.id}?${params.filter(Boolean).join('&')}`
}

/** Splits a `routeKey` into the route's id and how it's ridden. */
export function parseRouteKey(key: string): { id: string; variant?: RouteVariant } {
  const q = key.indexOf('?')
  if (q < 0) return { id: key }
  const params = key.slice(q + 1).split('&')
  const start = Number(params.find((p) => p.startsWith('start='))?.slice(6) ?? 0)
  return {
    id: key.slice(0, q),
    variant: { reverse: params.includes('reverse'), startM: Number.isFinite(start) ? start : 0 },
  }
}

/** Points every ROUTE_STEP_M from `from` to `to` along `pts` (sorted by `d`), plus the end. */
function resample(pts: readonly RoutePoint[], from: number, to: number): RoutePoint[] {
  const out: RoutePoint[] = []
  let j = 0
  for (let d = from; ; d += ROUTE_STEP_M) {
    const at = Math.min(d, to)
    while (j < pts.length - 2 && pts[j + 1]!.d < at) j++
    const a = pts[j]!
    const b = pts[j + 1]!
    const f = b.d > a.d ? (at - a.d) / (b.d - a.d) : 0
    out.push({
      lat: a.lat + (b.lat - a.lat) * f,
      lon: a.lon + (b.lon - a.lon) * f,
      ele: a.ele + (b.ele - a.ele) * f,
      d: at,
    })
    if (at >= to) break
  }
  // A sliver of a last segment would turn rounding noise into a steep grade: merge it.
  if (out.length > 2 && to - out.at(-2)!.d < ROUTE_STEP_M / 2) out.splice(-2, 1)
  return out
}

/** Climbing, grades and loop detection for evenly spaced points. */
function summarize(meta: RouteMeta, points: RoutePoint[], distanceM: number): Route {
  let ascentM = 0
  let descentM = 0
  for (let i = 1; i < points.length; i++) {
    const diff = points[i]!.ele - points[i - 1]!.ele
    if (diff > 0) ascentM += diff
    else descentM -= diff
  }
  const span = Math.round(MAX_GRADE_OVER_M / ROUTE_STEP_M)
  let maxGradePct = 0
  const lastIndex = points.length - 1
  for (let i = 0; i === 0 || i + span <= lastIndex; i++) {
    const g = gradePct(points[i]!, points[Math.min(lastIndex, i + span)]!)
    if (g > maxGradePct) maxGradePct = g
  }
  const first = points[0]!
  const last = points.at(-1)!
  return {
    ...meta,
    points,
    distanceM,
    ascentM: Math.round(ascentM),
    descentM: Math.round(descentM),
    avgGradePct: round1(((last.ele - first.ele) / distanceM) * 100),
    maxGradePct: round1(maxGradePct),
    loop: haversineM(first, last) < LOOP_GAP_M,
  }
}

/** Where `d` metres along the route is, and the grade there. */
export function routeAt(route: Route, d: number): RoutePosition {
  const at = Math.min(Math.max(0, d), route.distanceM)
  const here = interpolate(route, at)
  // Grade over GRADE_OVER_M around the rider, shifted inward at the start and end.
  const from = Math.max(0, Math.min(at - GRADE_OVER_M / 2, route.distanceM - GRADE_OVER_M))
  const to = Math.min(route.distanceM, from + GRADE_OVER_M)
  return {
    ...here,
    gradePct: gradePct(interpolate(route, from), interpolate(route, to)),
    d: at,
  }
}

function interpolate(route: Route, at: number): RoutePoint {
  const pts = route.points
  const i = Math.min(pts.length - 2, Math.floor(at / ROUTE_STEP_M))
  const a = pts[i]!
  const b = pts[i + 1]!
  const f = b.d > a.d ? (at - a.d) / (b.d - a.d) : 0
  return {
    lat: a.lat + (b.lat - a.lat) * f,
    lon: a.lon + (b.lon - a.lon) * f,
    ele: a.ele + (b.ele - a.ele) * f,
    d: at,
  }
}

/** Raw points of a route, for storing it compactly as `[lat, lon, ele]` triples. */
export function routeTriples(points: readonly GpxPoint[]): [number, number, number][] {
  return points.map((p) => [round(p.lat, 6), round(p.lon, 6), round1(p.ele ?? 0)])
}

export function fromTriples(triples: readonly (readonly number[])[]): GpxPoint[] {
  return triples.map(([lat, lon, ele]) => ({ lat: lat!, lon: lon!, ele }))
}

function gradePct(a: RoutePoint, b: RoutePoint): number {
  const run = b.d - a.d
  if (run <= 0) return 0
  const g = ((b.ele - a.ele) / run) * 100
  return Math.max(-MAX_GRADE_PCT, Math.min(MAX_GRADE_PCT, g))
}

/**
 * Moves rise above `capPct` onto the neighbouring segments, repeatedly, until no segment is
 * steeper. The total rise is unchanged, so start/end elevations and climbing stay the same.
 */
function limitGrades(ele: readonly number[], pts: readonly RoutePoint[], capPct: number): number[] {
  const rise = ele.slice(1).map((e, i) => e - ele[i]!)
  const limit = rise.map((_, i) => ((pts[i + 1]!.d - pts[i]!.d) * capPct) / 100)
  for (let pass = 0; pass < 5000; pass++) {
    let moved = false
    for (let i = 0; i < rise.length; i++) {
      const excess = Math.abs(rise[i]!) - limit[i]!
      if (excess <= 1e-6) continue
      const share = Math.sign(rise[i]!) * excess
      rise[i]! -= share
      const left = i > 0
      const right = i + 1 < rise.length
      if (left) rise[i - 1]! += right ? share / 2 : share
      if (right) rise[i + 1]! += left ? share / 2 : share
      moved = true
    }
    if (!moved) break
  }
  const out = [ele[0]!]
  for (const r of rise) out.push(out.at(-1)! + r)
  return out
}

/** Centred moving average with `half` points on each side; the window shrinks symmetrically
 * near the ends, so end elevations and constant grades are kept exactly. */
function smooth(values: readonly number[], half: number): number[] {
  const prefix = [0]
  for (const v of values) prefix.push(prefix.at(-1)! + v)
  return values.map((_, i) => {
    const k = Math.min(half, i, values.length - 1 - i)
    const lo = i - k
    const hi = i + k
    return (prefix[hi + 1]! - prefix[lo]!) / (hi - lo + 1)
  })
}

const EARTH_RADIUS_M = 6_371_008.8

/** Great-circle distance in metres. */
export function haversineM(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

const round = (n: number, digits: number): number => Math.round(n * 10 ** digits) / 10 ** digits
const round1 = (n: number): number => round(n, 1)
