import { describe, expect, it } from 'vitest'
import { builtinRoutes } from '../src'

// Published figures for each climb (distance km, climbing m, average %), with room for the
// generated start points and DEM resolution.
const EXPECTED: Record<string, { km: number; gain: number; avg: number }> = {
  'builtin:alpe-dhuez': { km: 14, gain: 1100, avg: 7.8 },
  'builtin:ventoux-bedoin': { km: 21.5, gain: 1600, avg: 7.3 },
  'builtin:stelvio-prato': { km: 25, gain: 1850, avg: 7.3 },
  'builtin:tourmalet-luz': { km: 19, gain: 1400, avg: 7.3 },
  'builtin:tourmalet-sainte-marie': { km: 17.2, gain: 1268, avg: 7.4 },
  'builtin:stelvio-bormio': { km: 21.5, gain: 1533, avg: 7.1 },
  'builtin:galibier-valloire': { km: 18.1, gain: 1245, avg: 6.9 },
  'builtin:izoard-briancon': { km: 19.2, gain: 1105, avg: 5.7 },
  'builtin:gavia-bormio': { km: 25.6, gain: 1400, avg: 5.5 },
  'builtin:sa-calobra': { km: 9.5, gain: 682, avg: 7.1 },
}

describe('builtinRoutes', () => {
  const routes = builtinRoutes()

  it('builds every route with an attribution', () => {
    expect(routes.length).toBeGreaterThanOrEqual(22)
    expect(new Set(routes.map((r) => r.id)).size).toBe(routes.length)
    for (const r of routes) {
      expect(r.source).toBe('builtin')
      expect(r.attribution).toMatch(/OpenStreetMap/)
      // +0.2: elevations are stored to 0.1 m.
      expect(r.maxGradePct).toBeLessThanOrEqual((r.gradeCapPct ?? 25) + 0.2)
    }
  })

  it.each(Object.entries(EXPECTED))('%s matches the published climb', (id, e) => {
    const r = routes.find((x) => x.id === id)!
    expect(r.distanceM / 1000).toBeGreaterThan(e.km * 0.93)
    expect(r.distanceM / 1000).toBeLessThan(e.km * 1.07)
    expect(r.ascentM).toBeGreaterThan(e.gain * 0.93)
    expect(r.ascentM).toBeLessThan(e.gain * 1.1)
    expect(Math.abs(r.avgGradePct - e.avg)).toBeLessThan(0.8)
  })

  it.each([
    'builtin:champs-elysees',
    'builtin:afsluitdijk',
    'builtin:belgian-coast',
    'builtin:regents-park',
    'builtin:strandvejen',
    'builtin:alcudia-bay',
  ])('%s is flat', (id) => {
    const r = routes.find((x) => x.id === id)!
    expect(r.ascentM / (r.distanceM / 1000)).toBeLessThan(10)
    expect(r.maxGradePct).toBeLessThanOrEqual(6)
  })

  it('has loops for long rides and workouts', () => {
    expect(routes.find((r) => r.id === 'builtin:annecy-loop')?.loop).toBe(true)
    expect(routes.find((r) => r.id === 'builtin:champs-elysees')?.loop).toBe(true)
    expect(routes.find((r) => r.id === 'builtin:regents-park')?.loop).toBe(true)
  })
})
