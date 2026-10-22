import { routeAt, type Route } from '../route/route'

// Gradient signs for the virtual world (E16-8), like the kilometre signs on Alpine cols: one where
// a climb starts, then one every kilometre while it lasts, each showing the average gradient of
// the stretch ahead.

export interface GradeSign {
  /** Distance along the route, metres. */
  d: number
  /** Average gradient of the stretch ahead, whole percent. */
  gradePct: number
}

/** A climb starts where the next START_OVER_M average at least START_PCT. */
const START_OVER_M = 500
const START_PCT = 4
/** While climbing, a sign every SIGN_EVERY_M showing the next SIGN_EVERY_M… */
const SIGN_EVERY_M = 1000
/** …as long as that stretch still averages at least KEEP_PCT. */
const KEEP_PCT = 3
/** Shortest stretch a sign describes (near the top of a climb). */
const MIN_STRETCH_M = 200
const STEP_M = 50

export function gradeSigns(route: Route): GradeSign[] {
  const end = route.distanceM
  const ele = (d: number): number => routeAt(route, Math.min(d, end)).ele
  /** Average gradient from `d` over `len` metres (shortened at the finish). */
  const avg = (d: number, len: number): number => {
    const to = Math.min(end, d + len)
    return to - d < 1 ? 0 : ((ele(to) - ele(d)) / (to - d)) * 100
  }
  const out: GradeSign[] = []
  let d = 0
  while (d < end - MIN_STRETCH_M) {
    if (avg(d, START_OVER_M) < START_PCT) {
      d += STEP_M
      continue
    }
    // On a climb: a sign now and then every kilometre until the road flattens.
    while (d < end - MIN_STRETCH_M) {
      const g = avg(d, SIGN_EVERY_M)
      if (g < KEEP_PCT) break
      out.push({ d, gradePct: Math.round(g) })
      d += SIGN_EVERY_M
    }
    d += STEP_M
  }
  return out
}
