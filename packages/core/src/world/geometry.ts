import type { Route } from '../route/route'

// Geometry for the optional virtual world (E16, DESIGN.md D22): the route in local metres, a
// smoothed centreline, position and heading at any distance, and where to put trees. Pure, so it
// is tested here; the renderer only turns it into meshes.
//
// Axes as in three.js: x = east, y = up, z = south (so north is −z).

export interface WorldPoint {
  x: number
  y: number
  z: number
  /** Distance along the route, metres. */
  d: number
}

const EARTH_R = 6_371_000
const RAD = Math.PI / 180

/** Route points in metres around the first point (equirectangular; fine over a few hundred km). */
export function routeToLocal(route: Route): WorldPoint[] {
  const p0 = route.points[0]!
  const kx = Math.cos(p0.lat * RAD) * EARTH_R * RAD
  const kz = EARTH_R * RAD
  return route.points.map((p) => ({
    x: (p.lon - p0.lon) * kx,
    y: p.ele - p0.ele,
    z: (p0.lat - p.lat) * kz,
    d: p.d,
  }))
}

/** A flat road heading north, for rides without a route. */
export function straightRoad(lengthM: number, stepM = 20): WorldPoint[] {
  const out: WorldPoint[] = []
  for (let d = 0; d <= lengthM; d += stepM) out.push({ x: 0, y: 0, z: 0 - d, d })
  return out
}

/**
 * Adds `lengthM` of straight, flat road before the start and after the finish, continuing the
 * first and last directions, so the camera never looks off the end of the road.
 */
export function extendEnds(pts: readonly WorldPoint[], lengthM = 150, stepM = 20): WorldPoint[] {
  if (pts.length < 2) return [...pts]
  const dir = (a: WorldPoint, b: WorldPoint): { x: number; z: number } => {
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
    return { x: (b.x - a.x) / len, z: (b.z - a.z) / len }
  }
  const first = pts[0]!
  const last = pts.at(-1)!
  const s0 = dir(first, pts[Math.min(3, pts.length - 1)]!)
  const s1 = dir(pts[Math.max(0, pts.length - 4)]!, last)
  const before: WorldPoint[] = []
  const after: WorldPoint[] = []
  for (let m = lengthM; m > 0; m -= stepM) {
    before.push({ x: first.x - s0.x * m, y: first.y, z: first.z - s0.z * m, d: first.d - m })
  }
  for (let m = stepM; m <= lengthM; m += stepM) {
    after.push({ x: last.x + s1.x * m, y: last.y, z: last.z + s1.z * m, d: last.d + m })
  }
  return [...before, ...pts, ...after]
}

/**
 * Inserts points every ~`stepM` with a Catmull-Rom curve through x/z (linear y and d), so
 * hairpins drawn from 20 m samples look like curves, not polygons.
 */
export function densify(pts: readonly WorldPoint[], stepM = 5): WorldPoint[] {
  if (pts.length < 3) return [...pts]
  const out: WorldPoint[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!
    const n = Math.max(1, Math.round((p2.d - p1.d) / stepM))
    for (let k = 0; k < n; k++) {
      const t = k / n
      out.push({
        x: catmull(p0.x, p1.x, p2.x, p3.x, t),
        y: p1.y + (p2.y - p1.y) * t,
        z: catmull(p0.z, p1.z, p2.z, p3.z, t),
        d: p1.d + (p2.d - p1.d) * t,
      })
    }
  }
  out.push({ ...pts.at(-1)! })
  return out
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  )
}

/** Index of the last point with `d` ≤ the given distance (binary search). */
function indexAt(pts: readonly WorldPoint[], d: number): number {
  let lo = 0
  let hi = pts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (pts[mid]!.d <= d) lo = mid
    else hi = mid - 1
  }
  return Math.min(lo, pts.length - 2)
}

export interface Frame {
  x: number
  y: number
  z: number
  /** Unit heading on the ground (x/z). */
  hx: number
  hz: number
  /** Slope as rise over run, for pitching the rider. */
  slope: number
}

/** Position and heading at distance `d`; the heading is averaged over ±`lookM` metres. */
export function frameAt(pts: readonly WorldPoint[], d: number, lookM = 8): Frame {
  const at = (dist: number): { x: number; y: number; z: number } => {
    const c = Math.min(Math.max(dist, pts[0]!.d), pts.at(-1)!.d)
    const i = indexAt(pts, c)
    const a = pts[i]!
    const b = pts[i + 1]!
    const t = b.d > a.d ? (c - a.d) / (b.d - a.d) : 0
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
  }
  const p = at(d)
  const ahead = at(d + lookM)
  const behind = at(d - lookM)
  const dx = ahead.x - behind.x
  const dz = ahead.z - behind.z
  const len = Math.hypot(dx, dz) || 1
  return {
    ...p,
    hx: dx / len,
    hz: dz / len,
    slope: (ahead.y - behind.y) / len,
  }
}

/** Small deterministic PRNG (mulberry32), so a route always gets the same scenery. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Hash of a string, for seeding scenery per route. */
export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Finds road points near a spot quickly (uniform grid over x/z). */
export class RoadIndex {
  private cells = new Map<number, WorldPoint[]>()
  /** Every 5th point on a coarser grid, for far lookups where metres don't matter. */
  private coarse: RoadIndex | undefined

  constructor(
    pts: readonly WorldPoint[],
    private cell = 40,
    coarse = true,
  ) {
    if (coarse)
      this.coarse = new RoadIndex(
        pts.filter((_, i) => i % 5 === 0),
        120,
        false,
      )
    for (const p of pts) {
      const k = this.key(p.x, p.z)
      let list = this.cells.get(k)
      if (!list) this.cells.set(k, (list = []))
      list.push(p)
    }
  }

  private key(x: number, z: number): number {
    return cellKey(Math.floor(x / this.cell), Math.floor(z / this.cell))
  }

  coarser(): RoadIndex | undefined {
    return this.coarse
  }

  /** Calls `fn` for every road point within `maxM`. */
  forEachWithin(
    x: number,
    z: number,
    maxM: number,
    fn: (p: WorldPoint, dist: number) => void,
  ): void {
    const r = Math.ceil(maxM / this.cell)
    const cx = Math.floor(x / this.cell)
    const cz = Math.floor(z / this.cell)
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        for (const p of this.cells.get(cellKey(cx + i, cz + j)) ?? []) {
          const dist = Math.hypot(p.x - x, p.z - z)
          if (dist <= maxM) fn(p, dist)
        }
      }
    }
  }

  /** The nearest road point within `maxM`, if any. */
  nearest(x: number, z: number, maxM: number): { p: WorldPoint; dist: number } | undefined {
    const r = Math.ceil(maxM / this.cell)
    const cx = Math.floor(x / this.cell)
    const cz = Math.floor(z / this.cell)
    let best: { p: WorldPoint; dist: number } | undefined
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        for (const p of this.cells.get(cellKey(cx + i, cz + j)) ?? []) {
          const dist = Math.hypot(p.x - x, p.z - z)
          if (dist <= maxM && (!best || dist < best.dist)) best = { p, dist }
        }
      }
    }
    return best
  }
}

/** Grid cell coordinates as one number (routes stay well within ±10⁵ cells). */
const cellKey = (i: number, j: number): number => (i + 100_000) * 200_001 + (j + 100_000)

/**
 * Smooth value noise in [−1, 1] over x/z with the given wavelength. With `periodZ` it repeats every
 * `periodZ` metres along z (the wavelength is adjusted to fit a whole number of cells).
 */
function valueNoise(
  x: number,
  z: number,
  wavelength: number,
  seed: number,
  periodZ?: number,
): number {
  const cellsZ = periodZ ? Math.max(1, Math.round(periodZ / wavelength)) : 0
  const wz = periodZ ? periodZ / cellsZ : wavelength
  const fx = x / wavelength
  const fz = z / wz
  const ix = Math.floor(fx)
  const iz = Math.floor(fz)
  const tx = fx - ix
  const tz = fz - iz
  const h = (i: number, j0: number): number => {
    const j = cellsZ ? ((j0 % cellsZ) + cellsZ) % cellsZ : j0
    let n = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ seed
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 2147483648 - 1
  }
  const sx = tx * tx * (3 - 2 * tx)
  const sz = tz * tz * (3 - 2 * tz)
  const a = h(ix, iz) + (h(ix + 1, iz) - h(ix, iz)) * sx
  const b = h(ix, iz + 1) + (h(ix + 1, iz + 1) - h(ix, iz + 1)) * sx
  return a + (b - a) * sz
}

/** Ground keeps to the road near it and rolls into hills further out. */
const FLAT_M = 8
/** Ground sits this far under the road surface, so a coarse grid never pokes through it. */
const GROUND_BELOW_ROAD_M = 0.5
const HILLS_FROM_M = 80

/** Away from the road, ground blends the heights of all road within this distance… */
const BLEND_M = 150
/** …fully from this far out (closer in it follows the nearest road). */
const BLEND_FROM_M = 30
/**
 * Every ground point this close to any road stays under it. Must exceed a terrain cell's diagonal
 * (15 m cells → 21.2 m), so every triangle touching the road lies below it.
 */
export const CARVE_M = 22

const smooth = (from: number, to: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

/**
 * Ground height at (x, z). Next to a road it is just under that road; further out it blends the
 * heights of the roads around (so the ground between switchbacks is a slope, not a step) and rolls
 * into hills. It never rises above any road within `CARVE_M`.
 */
export function groundHeight(
  index: RoadIndex,
  x: number,
  z: number,
  seed: number,
  periodZ?: number,
): number {
  const near = nearestRoad(index, x, z)
  if (!near) return 0
  // Inverse-distance blend of nearby road heights (coarse points are plenty for slopes).
  let sum = 0
  let weights = 0
  index.coarser()?.forEachWithin(x, z, BLEND_M, (p, dist) => {
    const w = 1 / (dist * dist + 100)
    sum += w * p.y
    weights += w
  })
  const blended = weights > 0 ? sum / weights : near.p.y
  const b = smooth(FLAT_M, BLEND_FROM_M, near.dist)
  const base = near.p.y + (blended - near.p.y) * b
  const hills =
    14 * valueNoise(x, z, 160, seed, periodZ) + 4 * valueNoise(x, z, 45, seed + 1, periodZ)
  let y = base - GROUND_BELOW_ROAD_M + smooth(FLAT_M, HILLS_FROM_M, near.dist) * hills
  index.forEachWithin(x, z, CARVE_M, (p) => {
    y = Math.min(y, p.y - GROUND_BELOW_ROAD_M)
  })
  return y
}

/** Nearest road point at any distance: exact within `FINE_M`, approximate (±15 m) beyond, which covers every terrain tile. */
const FINE_M = 40
const FAR_M = 500

function nearestRoad(
  index: RoadIndex,
  x: number,
  z: number,
): { p: WorldPoint; dist: number } | undefined {
  return index.nearest(x, z, FINE_M) ?? index.coarser()?.nearest(x, z, FAR_M)
}

export interface TerrainGrid {
  /** x, y, z per vertex. */
  positions: Float32Array
  /** Three vertex indices per triangle. */
  indices: Uint32Array
}

/**
 * Ground around the road as square tiles of a regular grid, only where the road passes within
 * `reachM`. Every vertex takes its height from `groundHeight`, so neighbouring tiles meet without
 * cracks and ground can't rise over another stretch of road (hairpins), as strips across the road
 * would.
 */
export function terrainGrid(
  pts: readonly WorldPoint[],
  index: RoadIndex,
  seed: number,
  tileM = 120,
  cellM = 15,
  reachM = 220,
  /** Hills repeat every this many metres along z (the endless straight road). */
  periodZ?: number,
): TerrainGrid {
  // Tiles whose centre is within reach of the road (plus half a tile diagonal).
  const tiles = new Set<number>()
  const r = Math.ceil(reachM / tileM) + 1
  const within = reachM + tileM * 0.71
  for (let i = 0; i < pts.length; i += 4) {
    const p = pts[i]!
    const tx = Math.floor(p.x / tileM)
    const tz = Math.floor(p.z / tileM)
    for (let a = -r; a <= r; a++) {
      for (let b = -r; b <= r; b++) {
        const cx = (tx + a + 0.5) * tileM
        const cz = (tz + b + 0.5) * tileM
        if (Math.hypot(cx - p.x, cz - p.z) <= within) tiles.add(cellKey(tx + a, tz + b))
      }
    }
  }
  const n = Math.round(tileM / cellM)
  const positions = new Float32Array(tiles.size * (n + 1) ** 2 * 3)
  const indices = new Uint32Array(tiles.size * n * n * 6)
  let v = 0
  let t = 0
  for (const key of tiles) {
    const tx = Math.floor(key / 200_001) - 100_000
    const tz = (key % 200_001) - 100_000
    const base = v / 3
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const x = (tx * n + i) * cellM
        const z = (tz * n + j) * cellM
        positions[v++] = x
        positions[v++] = groundHeight(index, x, z, seed, periodZ)
        positions[v++] = z
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = base + j * (n + 1) + i
        indices[t++] = a
        indices[t++] = a + n + 1
        indices[t++] = a + 1
        indices[t++] = a + 1
        indices[t++] = a + n + 1
        indices[t++] = a + n + 2
      }
    }
  }
  return { positions, indices }
}

/**
 * Low-detail land out to `marginM` around the route, so the view doesn't end where the detailed
 * ground does (on a mountain that edge is a cliff). Heights follow the general slope of the road
 * (inverse-distance blend of road points every ~100 m) plus the same hills, a few metres under the
 * detailed ground so that one covers it near the road.
 */
export function distantLand(
  pts: readonly WorldPoint[],
  seed: number,
  marginM = 2000,
  cellM = 150,
  periodZ?: number,
): TerrainGrid {
  const sparse = pts.filter((_, i) => i % 20 === 0)
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z)
    maxZ = Math.max(maxZ, p.z)
  }
  const x0 = Math.floor((minX - marginM) / cellM) * cellM
  const z0 = Math.floor((minZ - marginM) / cellM) * cellM
  const nx = Math.ceil((maxX + marginM - x0) / cellM)
  const nz = Math.ceil((maxZ + marginM - z0) / cellM)
  const positions = new Float32Array((nx + 1) * (nz + 1) * 3)
  const indices = new Uint32Array(nx * nz * 6)
  let v = 0
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = x0 + i * cellM
      const z = z0 + j * cellM
      let sum = 0
      let weights = 0
      for (const p of sparse) {
        // Fourth power: nearby road dominates, so a valley isn't lifted by the summit far away.
        const w = 1 / ((p.x - x) ** 2 + (p.z - z) ** 2 + 2500) ** 2
        sum += w * p.y
        weights += w
      }
      const hills =
        14 * valueNoise(x, z, 160, seed, periodZ) + 4 * valueNoise(x, z, 45, seed + 1, periodZ)
      positions[v++] = x
      positions[v++] = sum / weights + hills - DISTANT_BELOW_M
      positions[v++] = z
    }
  }
  let t = 0
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i
      indices[t++] = a
      indices[t++] = a + nx + 1
      indices[t++] = a + 1
      indices[t++] = a + 1
      indices[t++] = a + nx + 1
      indices[t++] = a + nx + 2
    }
  }
  return { positions, indices }
}

/** Distant land sits this far under where the detailed ground would be. */
const DISTANT_BELOW_M = 6

export interface TreeSpot {
  x: number
  y: number
  z: number
  /** Size factor, about 0.7–1.4. */
  scale: number
}

/**
 * Trees beside the road: one candidate every `everyM` metres on a random side, `minOff`–`maxOff`
 * metres out, skipped when it would stand on (any part of) the road.
 */
export function scatterTrees(
  pts: readonly WorldPoint[],
  seed: number,
  everyM = 12,
  minOff = 7,
  maxOff = 70,
  index = new RoadIndex(pts),
  periodZ?: number,
): TreeSpot[] {
  const rnd = seeded(seed)
  const out: TreeSpot[] = []
  const end = pts.at(-1)!.d
  for (let d = pts[0]!.d; d < end; d += everyM * (0.5 + rnd())) {
    const f = frameAt(pts, d)
    const side = rnd() < 0.5 ? -1 : 1
    const off = minOff + (maxOff - minOff) * rnd() ** 1.5
    // Left of the heading (hx, hz) is (hz, −hx).
    const x = f.x + side * f.hz * off
    const z = f.z - side * f.hx * off
    if (index.nearest(x, z, minOff - 1)) continue
    out.push({ x, y: groundHeight(index, x, z, seed, periodZ), z, scale: 0.7 + rnd() * 0.7 })
  }
  return out
}
