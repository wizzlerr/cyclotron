import { describe, expect, it } from 'vitest'
import {
  buildRoute,
  densify,
  distantLand,
  extendEnds,
  frameAt,
  groundHeight,
  kneeAt,
  legPose,
  RIDER_DIMS,
  RoadIndex,
  routeToLocal,
  scatterTrees,
  straightRoad,
  terrainGrid,
  type GpxPoint,
} from '../src'

/** About 1 km north, then a hairpin back south 30 m to the east. */
const hairpin = (): GpxPoint[] => {
  const pts: GpxPoint[] = []
  for (let i = 0; i <= 50; i++) pts.push({ lat: 46 + (i * 20) / 111_195, lon: 7, ele: 500 + i })
  for (let i = 0; i <= 50; i++) {
    pts.push({ lat: 46 + ((50 - i) * 20) / 111_195, lon: 7 + 30 / 77_000, ele: 551 + i })
  }
  return pts
}

describe('world geometry', () => {
  it('projects a route to local metres, north = −z', () => {
    const pts = routeToLocal(buildRoute({ id: 'h', name: 'h', source: 'gpx' }, hairpin()))
    expect(pts[0]).toMatchObject({ x: 0, y: 0, z: 0, d: 0 })
    const top = pts.reduce((a, b) => (b.z < a.z ? b : a))
    expect(top.z).toBeLessThan(-950)
    expect(Math.abs(top.x)).toBeLessThan(40)
  })

  it('densifies smoothly, keeping both ends and increasing distance', () => {
    const pts = straightRoad(100, 20)
    const dense = densify(pts, 5)
    expect(dense).toHaveLength(21)
    expect(dense[0]).toEqual(pts[0])
    expect(dense.at(-1)).toEqual(pts.at(-1))
    for (let i = 1; i < dense.length; i++) expect(dense[i]!.d).toBeGreaterThan(dense[i - 1]!.d)
  })

  it('extends the road straight before the start and after the finish', () => {
    const pts = extendEnds(straightRoad(100), 60)
    expect(pts[0]).toMatchObject({ x: 0, z: 60, d: -60 })
    expect(pts.at(-1)).toMatchObject({ x: 0, z: -160, d: 160 })
    for (let i = 1; i < pts.length; i++) expect(pts[i]!.d).toBeGreaterThan(pts[i - 1]!.d)
  })

  it('gives position and heading along the road', () => {
    const f = frameAt(straightRoad(500), 250)
    expect(f.z).toBeCloseTo(-250)
    expect(f.hx).toBeCloseTo(0)
    expect(f.hz).toBeCloseTo(-1)
    expect(f.slope).toBeCloseTo(0)
  })

  it('keeps trees off every part of the road, also at hairpins', () => {
    const pts = densify(routeToLocal(buildRoute({ id: 'h', name: 'h', source: 'gpx' }, hairpin())))
    const index = new RoadIndex(pts)
    const trees = scatterTrees(pts, 42, 12, 7, 70, index)
    expect(trees.length).toBeGreaterThan(50)
    for (const t of trees) expect(index.nearest(t.x, t.z, 6)).toBeUndefined()
    // Same seed, same forest.
    expect(scatterTrees(pts, 42, 12, 7, 70, index)).toEqual(trees)
  })

  it('puts the ground just under the road and rolls it into hills further out', () => {
    const pts = straightRoad(1000)
    const index = new RoadIndex(pts)
    expect(groundHeight(index, 2, -500, 1)).toBeCloseTo(-0.5)
    const far = [100, 120, 140].map((x) => groundHeight(index, x, -500, 1))
    expect(far.some((h) => Math.abs(h + 0.5) > 0.5)).toBe(true)
  })
})

describe('endless straight road', () => {
  it('repeats the hills along the road', () => {
    const index = new RoadIndex(straightRoad(1400))
    for (const x of [30, 90, 150]) {
      expect(groundHeight(index, x, -300, 3, 240)).toBeCloseTo(groundHeight(index, x, -540, 3, 240))
    }
  })
})

describe('terrain grid', () => {
  it('stays under every part of the road, also where the road curls back on itself', () => {
    const pts = densify(routeToLocal(buildRoute({ id: 'h', name: 'h', source: 'gpx' }, hairpin())))
    const index = new RoadIndex(pts)
    const grid = terrainGrid(pts, index, 7, 120, 12)
    expect(grid.indices.length % 3).toBe(0)
    // Sample the triangles at road points: the ground must be below the road there.
    const tri = grid.indices
    const pos = grid.positions
    let checked = 0
    for (const p of pts.filter((_, i) => i % 7 === 0)) {
      for (let k = 0; k < tri.length; k += 3) {
        const [a, b, c] = [tri[k]!, tri[k + 1]!, tri[k + 2]!].map((i) => [
          pos[3 * i]!,
          pos[3 * i + 1]!,
          pos[3 * i + 2]!,
        ])
        const h = heightInTriangle(p.x, p.z, a!, b!, c!)
        if (h === undefined) continue
        expect(h, `d=${p.d}`).toBeLessThan(p.y)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(20)
  })
})

/** Height of the triangle at (x, z), or undefined when (x, z) is outside it. */
function heightInTriangle(
  x: number,
  z: number,
  a: number[],
  b: number[],
  c: number[],
): number | undefined {
  const det = (b[2]! - c[2]!) * (a[0]! - c[0]!) + (c[0]! - b[0]!) * (a[2]! - c[2]!)
  const l1 = ((b[2]! - c[2]!) * (x - c[0]!) + (c[0]! - b[0]!) * (z - c[2]!)) / det
  const l2 = ((c[2]! - a[2]!) * (x - c[0]!) + (a[0]! - c[0]!) * (z - c[2]!)) / det
  const l3 = 1 - l1 - l2
  if (l1 < 0 || l2 < 0 || l3 < 0) return undefined
  return l1 * a[1]! + l2 * b[1]! + l3 * c[1]!
}

describe('ground between switchbacks', () => {
  it('is a slope, not a step', () => {
    // Two parallel roads 60 m apart, the second 40 m higher.
    const low = straightRoad(400).map((p) => ({ ...p, x: 0 }))
    const high = straightRoad(400).map((p) => ({ ...p, x: 60, y: 40, d: p.d + 1000 }))
    const index = new RoadIndex([...low, ...high])
    const across = [10, 20, 30, 40, 50].map((x) => groundHeight(index, x, -200, 1))
    for (let i = 1; i < across.length; i++) {
      expect(across[i]! - across[i - 1]!, `x=${10 + i * 10}`).toBeLessThan(25)
    }
    expect(across[2]!).toBeGreaterThan(5)
    expect(across[2]!).toBeLessThan(35)
  })
})

describe('distant land', () => {
  it('surrounds the route and follows its general height', () => {
    // A climb: 2 km north rising 200 m.
    const pts = straightRoad(2000).map((p) => ({ ...p, y: p.d / 10 }))
    const land = distantLand(pts, 1, 1000, 200)
    const xs = land.positions.filter((_, i) => i % 3 === 0)
    const heightNear = (z: number): number => {
      let best = Infinity
      let h = 0
      for (let i = 0; i < land.positions.length; i += 3) {
        const d = Math.hypot(land.positions[i]! - 400, land.positions[i + 2]! - z)
        if (d < best) [best, h] = [d, land.positions[i + 1]!]
      }
      return h
    }
    expect(Math.min(...xs)).toBeLessThanOrEqual(-1000)
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(1000)
    // Higher beside the top of the climb than beside its foot.
    expect(heightNear(-1900)).toBeGreaterThan(heightNear(-100) + 80)
  })
})

describe('rider pose', () => {
  it('keeps the foot on the pedal circle and the leg lengths constant', () => {
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const p = legPose(a)
      expect(Math.hypot(p.footX, p.footY)).toBeCloseTo(RIDER_DIMS.crank)
      const k = kneeAt(p)
      expect(Math.hypot(k.x - RIDER_DIMS.hipX, k.y - RIDER_DIMS.hipY)).toBeCloseTo(RIDER_DIMS.thigh)
      expect(Math.hypot(p.footX - k.x, p.footY - k.y)).toBeCloseTo(RIDER_DIMS.shin, 2)
      // The knee bends forward, never backwards.
      expect(p.knee).toBeGreaterThanOrEqual(0)
      expect(k.x).toBeGreaterThan(RIDER_DIMS.hipX - 0.05)
    }
  })
})
