import { describe, expect, it } from 'vitest'
import {
  cleanLayout,
  clampSize,
  defaultLayout,
  GRID_COLUMNS,
  legacyLayout,
  moveTile,
  newTileKey,
} from '../src/ride/layout'

describe('ride tile layout', () => {
  it('default fills two rows of 12 columns', () => {
    const tiles = defaultLayout()
    expect(tiles.reduce((a, t) => a + t.w, 0)).toBe(2 * GRID_COLUMNS)
    expect(new Set(tiles.map((t) => t.key)).size).toBe(tiles.length)
  })

  it('clamps sizes', () => {
    expect(clampSize(0, 9)).toEqual({ w: 1, h: 4 })
    expect(clampSize(13.4, 1.6)).toEqual({ w: 12, h: 2 })
    expect(clampSize(NaN, NaN)).toEqual({ w: 1, h: 1 })
  })

  it('cleans saved layouts', () => {
    expect(cleanLayout('nope')).toBeUndefined()
    const tiles = cleanLayout([
      { key: 'a', metrics: ['hr', 'bogus'], w: 20, h: 0, bg: '#ff0000', fg: 'red', zoneBar: false },
      { key: 'a', metrics: ['power3s', 'target', 'np', 'tss'], w: 3, h: 1 },
      { key: 'c', metrics: ['bogus'], w: 3, h: 1 },
      null,
    ])
    expect(tiles).toEqual([
      { key: 'a', metrics: ['hr'], w: 12, h: 1, bg: '#ff0000', zoneBar: false },
      { key: 'a_', metrics: ['power3s', 'target', 'np'], w: 3, h: 1 },
    ])
  })

  it('moves the old tile choice over', () => {
    const tiles = legacyLayout(['powerTarget', 'time', 'hr', 'kj', 'gone'])
    expect(tiles.map((t) => [t.metrics, t.w])).toEqual([
      [['power3s', 'target'], 3],
      [['intervalLeft', 'elapsed', 'total'], 6],
      [['hr'], 3],
      [['kcal'], 3],
    ])
  })

  it('moves a tile to another tile’s place', () => {
    const tiles = legacyLayout(['hr', 'cadence', 'tss', 'kcal'])
    const keys = (ts: { key: string }[]): string[] => ts.map((t) => t.key)
    expect(keys(moveTile(tiles, 't0', 't2'))).toEqual(['t1', 't2', 't0', 't3'])
    expect(keys(moveTile(tiles, 't3', 't1'))).toEqual(['t0', 't3', 't1', 't2'])
    expect(keys(moveTile(tiles, 't3', 'nope'))).toEqual(keys(tiles))
  })

  it('makes unused keys', () => {
    expect(newTileKey([{ key: 't1', metrics: ['hr'], w: 1, h: 1 }])).toBe('t2')
    expect(newTileKey([])).toBe('t0')
  })
})
