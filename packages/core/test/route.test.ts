import { Decoder, Stream } from '@garmin/fitsdk'
import { describe, expect, it } from 'vitest'
import {
  buildRoute,
  DEFAULT_PHYSICS,
  encodeFitActivity,
  fromTriples,
  GpxError,
  haversineM,
  parseGpx,
  ROUTE_STEP_M,
  routeAt,
  RouteRider,
  routeTriples,
  steadySpeed,
  stepSpeed,
  summarizeRide,
  trainerGradePct,
  type GpxPoint,
  type RideSample,
} from '../src'

const M_PER_DEG_LAT = 111_195

/** A straight road north from (45, 6): `lengthM` long at a constant grade. */
function straight(lengthM: number, gradePct: number, stepM = 50): GpxPoint[] {
  const pts: GpxPoint[] = []
  for (let d = 0; d <= lengthM; d += stepM) {
    pts.push({ lat: 45 + d / M_PER_DEG_LAT, lon: 6, ele: 100 + (d * gradePct) / 100 })
  }
  return pts
}

const meta = { id: 'test', name: 'Test', source: 'gpx' as const }
const physics = { ...DEFAULT_PHYSICS, massKg: 83 }

describe('parseGpx', () => {
  it('reads track points, elevation and the track name', () => {
    const gpx = parseGpx(`<?xml version="1.0"?>
      <gpx version="1.1" creator="Some App">
        <metadata><name>Some App export</name></metadata>
        <!-- <trkpt lat="1" lon="1"/> -->
        <trk><name>Col &amp; Back</name><trkseg>
          <trkpt lat="45.0" lon="6.0"><ele>700.5</ele><time>2026-01-01T00:00:00Z</time></trkpt>
          <trkpt lat='45.001' lon='6.001'><ele>705</ele></trkpt>
          <trkpt lat="45.002" lon="6.002"/>
        </trkseg></trk>
      </gpx>`)
    expect(gpx.name).toBe('Col & Back')
    expect(gpx.points).toEqual([
      { lat: 45, lon: 6, ele: 700.5 },
      { lat: 45.001, lon: 6.001, ele: 705 },
      { lat: 45.002, lon: 6.002 },
    ])
  })

  it('falls back to route points and rejects files without points', () => {
    const rte = parseGpx('<gpx><rte><rtept lat="1" lon="2"/><rtept lat="1.1" lon="2"/></rte></gpx>')
    expect(rte.points).toHaveLength(2)
    expect(() => parseGpx('<gpx><trk/></gpx>')).toThrow(GpxError)
    expect(() => parseGpx('<workout_file/>')).toThrow(GpxError)
  })
})

describe('buildRoute', () => {
  it('resamples evenly and measures distance, climbing and grade', () => {
    const route = buildRoute(meta, straight(1000, 5))
    expect(route.distanceM).toBeCloseTo(1000, -1)
    expect(route.points[1]!.d).toBe(ROUTE_STEP_M)
    expect(route.points.at(-1)!.d).toBe(route.distanceM)
    expect(route.ascentM).toBeCloseTo(50, 0)
    expect(route.descentM).toBe(0)
    expect(route.avgGradePct).toBeCloseTo(5, 1)
    expect(route.maxGradePct).toBeCloseTo(5, 1)
    expect(route.loop).toBe(false)
  })

  it('smooths a single bad elevation point instead of making a wall', () => {
    const pts = straight(2000, 0, 20)
    pts[50]!.ele = 130 // a 30 m spike on a flat road
    const route = buildRoute(meta, pts)
    expect(route.maxGradePct).toBeLessThan(6)
  })

  it('caps grades without changing the total climb', () => {
    const pts = straight(3000, 6, 20)
    // A 300 m stretch at ~26 %: an elevation-model artefact.
    for (let i = 75; i < 90; i++) pts[i]!.ele = pts[i]!.ele! + (i - 74) * 4
    for (let i = 90; i < pts.length; i++) pts[i]!.ele = pts[i]!.ele! + 60
    const raw = buildRoute(meta, pts)
    const capped = buildRoute({ ...meta, gradeCapPct: 12 }, pts)
    expect(raw.maxGradePct).toBeGreaterThan(15)
    expect(capped.maxGradePct).toBeLessThanOrEqual(12)
    expect(capped.points.at(-1)!.ele).toBeCloseTo(raw.points.at(-1)!.ele, 0)
    expect(capped.ascentM).toBeCloseTo(raw.ascentM, -1)
  })

  it('looks up position and grade by distance', () => {
    const route = buildRoute(meta, straight(1000, 4))
    const p = routeAt(route, 500)
    expect(p.gradePct).toBeCloseTo(4, 1)
    expect(p.ele).toBeCloseTo(120, 0)
    expect(haversineM({ lat: 45, lon: 6 }, p)).toBeCloseTo(500, -1)
    expect(routeAt(route, 5000).d).toBe(route.distanceM)
  })

  it('round-trips through compact triples', () => {
    const pts = straight(500, 3)
    const back = fromTriples(routeTriples(pts))
    expect(back).toHaveLength(pts.length)
    back.forEach((p, i) => {
      expect(p.lat).toBeCloseTo(pts[i]!.lat, 6)
      expect(p.ele).toBeCloseTo(pts[i]!.ele!, 1)
    })
  })
})

describe('physics', () => {
  // Hand-solved from P·η = (m·g·(Crr·cosθ + sinθ) + ½ρ·CdA·v²)·v for 83 kg, CdA 0.32, Crr 0.004.
  it('gives known speeds: ~36.8 km/h at 250 W on the flat, ~12.4 km/h up 8 %', () => {
    expect(steadySpeed(250, 0, physics) * 3.6).toBeCloseTo(36.8, 0)
    expect(steadySpeed(250, 8, physics) * 3.6).toBeCloseTo(12.4, 0)
    expect(steadySpeed(0, 0, physics)).toBe(0)
  })

  it('coasts downhill at a terminal speed', () => {
    const v = steadySpeed(0, -6, physics) * 3.6
    expect(v).toBeGreaterThan(50)
    expect(v).toBeLessThan(65)
  })

  it('accelerates toward the steady speed with momentum', () => {
    let v = 0
    v = stepSpeed(v, 250, 0, 1, physics)
    expect(v).toBeGreaterThan(0)
    expect(v).toBeLessThan(5)
    for (let i = 0; i < 300; i++) v = stepSpeed(v, 250, 0, 1, physics)
    expect(v).toBeCloseTo(steadySpeed(250, 0, physics), 1)
  })
})

describe('RouteRider', () => {
  it('rides to the end of a route and stops there', () => {
    const route = buildRoute(meta, straight(1000, 5))
    const rider = new RouteRider(route, physics, { wrap: false })
    let seconds = 0
    while (!rider.finished && seconds < 3600) {
      rider.step(250, 1)
      seconds++
    }
    expect(rider.finished).toBe(true)
    expect(rider.distanceM).toBe(route.distanceM)
    expect(rider.climbedM).toBeCloseTo(50, 0)
    // ~1 km at ~19.8 km/h (steady speed up 5 %), plus getting up to speed.
    expect(seconds).toBeGreaterThan(180)
    expect(seconds).toBeLessThan(240)
  })

  it('wraps around when asked (workouts on a route)', () => {
    const route = buildRoute(meta, straight(200, 0))
    const rider = new RouteRider(route, physics, { wrap: true })
    for (let i = 0; i < 120; i++) rider.step(250, 1)
    expect(rider.finished).toBe(false)
    expect(rider.distanceM).toBeGreaterThan(route.distanceM)
    expect(rider.position.d).toBeLessThan(route.distanceM)
  })
})

describe('RouteRider.placeAt', () => {
  it('continues an interrupted ride from where it stopped', () => {
    const route = buildRoute(meta, straight(1000, 5))
    const rider = new RouteRider(route, physics, { wrap: false })
    rider.placeAt(400, 20)
    expect(rider.distanceM).toBe(400)
    expect(rider.climbedM).toBe(20)
    expect(rider.position.d).toBeCloseTo(400)
    expect(rider.speedMps).toBe(0)
    rider.step(250, 10)
    expect(rider.distanceM).toBeGreaterThan(400)
    expect(rider.climbedM).toBeGreaterThan(20)
  })
})

describe('trainerGradePct', () => {
  it('scales by difficulty and rounds to 0.1 %', () => {
    expect(trainerGradePct(8.04, 0.5)).toBe(4)
    expect(trainerGradePct(-6, 0.5)).toBe(-3)
    expect(trainerGradePct(10, 1.5)).toBe(10)
    expect(trainerGradePct(-0.01, 0.5)).toBe(0)
  })
})

describe('route rides in FIT', () => {
  it('writes GPS, altitude and distance, as a virtual ride', () => {
    const samples: RideSample[] = Array.from({ length: 60 }, (_, i) => ({
      t: i + 1,
      powerW: 200,
      speedKmh: 36,
      lat: 45 + (i * 10) / M_PER_DEG_LAT,
      lon: 6,
      altitudeM: 100 + i * 0.5,
      distanceM: (i + 1) * 10,
    }))
    const summary = summarizeRide(samples, 200)
    expect(summary.distanceM).toBeCloseTo(600, 0)
    expect(summary.ascentM).toBeCloseTo(29.5, 1)

    const bytes = encodeFitActivity({
      startedAtMs: Date.UTC(2026, 9, 21),
      utcOffsetMin: 0,
      samples,
      ftpW: 200,
    })
    const { messages, errors } = new Decoder(Stream.fromByteArray(bytes)).read()
    expect(errors).toEqual([])
    const rec = messages.recordMesgs![10]!
    expect((rec.positionLat as number) * (180 / 2 ** 31)).toBeCloseTo(45 + 100 / M_PER_DEG_LAT, 6)
    expect(rec.altitude).toBeCloseTo(105, 0)
    expect(rec.distance).toBeCloseTo(110, 1)
    expect(messages.sessionMesgs?.[0]).toMatchObject({
      subSport: 'virtualActivity',
      totalAscent: 30,
    })
  })
})
