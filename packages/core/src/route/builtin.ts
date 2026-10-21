// Built-in routes (E13-7): classic climbs and a loop, generated from open data by
// scripts/build-routes.mjs (OpenStreetMap roads, EU-DEM elevation; see each route's attribution).

import data from './builtin-routes.json'
import { buildRoute, fromTriples, type Route } from './route'

interface BuiltinRouteData {
  id: string
  name: string
  description: string
  attribution: string
  gradeCapPct?: number
  points: number[][]
}

let cache: Route[] | undefined

/** Built once, on first use. */
export function builtinRoutes(): readonly Route[] {
  cache ??= (data as BuiltinRouteData[]).map(({ points, ...meta }) =>
    buildRoute({ ...meta, source: 'builtin' }, fromTriples(points)),
  )
  return cache
}
