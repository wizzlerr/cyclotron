import { describe, expect, it } from 'vitest'
import {
  cleanPanelStyle,
  addPanel,
  addTile,
  cleanLayout,
  clampSize,
  defaultLayout,
  dropEmptyRows,
  findSpot,
  GRID_COLUMNS,
  legacyLayout,
  newTileKey,
  overlaps,
  placeTile,
  PANEL_IDS,
  type TileSpec,
  withPanels,
} from '../src/ride/layout'
import {
  PREVIEW_SAMPLE_S,
  PREVIEW_TOTAL_S,
  previewChart,
  previewRide,
  previewTimeline,
} from '../src/ride/preview'

const tile = (key: string, x: number, y: number, w = 3, h = 1, extra = {}): TileSpec => ({
  key,
  metrics: ['hr'],
  x,
  y,
  w,
  h,
  ...extra,
})
const at = (ts: TileSpec[]): Record<string, [number, number]> =>
  Object.fromEntries(ts.map((t) => [t.key, [t.x, t.y]]))
const noOverlaps = (ts: TileSpec[]): boolean =>
  ts.every((a, i) => ts.every((b, j) => i === j || !overlaps(a, b)))

describe('ride tile layout', () => {
  it('default: two full rows of numbers, then every panel', () => {
    const tiles = defaultLayout()
    const numbers = tiles.filter((t) => !t.panel && t.y < 2)
    expect(numbers.reduce((a, t) => a + t.w, 0)).toBe(2 * GRID_COLUMNS)
    expect(
      tiles
        .filter((t) => t.panel)
        .map((t) => t.panel)
        .sort(),
    ).toEqual([...PANEL_IDS].sort())
    expect(noOverlaps(tiles)).toBe(true)
    expect(new Set(tiles.map((t) => t.key)).size).toBe(tiles.length)
  })

  it('adds the panels under a layout from before panels, once', () => {
    const old = cleanLayout([{ key: 't0', metrics: ['hr'], x: 0, y: 0, w: 12, h: 2 }])!
    const tiles = withPanels(old)
    expect(tiles.find((t) => t.panel === 'world')).toMatchObject({ y: 3, w: 12 })
    expect(tiles.find((t) => t.panel === 'chart')).toMatchObject({ y: 10 })
    expect(noOverlaps(tiles)).toBe(true)
    expect(new Set(tiles.map((t) => t.key)).size).toBe(tiles.length)
    expect(withPanels(tiles.filter((t) => t.panel !== 'map'))).toHaveLength(tiles.length - 1)
  })

  it('keeps one of each panel and adds missing ones at the bottom', () => {
    const tiles = cleanLayout([
      { key: 'a', panel: 'chart', metrics: ['hr'], x: 0, y: 0, w: 12, h: 3 },
      { key: 'b', panel: 'chart', x: 0, y: 3, w: 12, h: 3 },
      { key: 'c', panel: 'radar', x: 0, y: 6, w: 12, h: 3 },
    ])!
    expect(tiles).toEqual([{ key: 'a', panel: 'chart', metrics: [], x: 0, y: 0, w: 12, h: 3 }])
    expect(addPanel(tiles, 'chart')).toHaveLength(1)
    expect(addPanel(tiles, 'map').at(-1)).toMatchObject({ panel: 'map', x: 0, y: 3, w: 3, h: 2 })
  })

  it('clamps sizes', () => {
    expect(clampSize(0, 19)).toEqual({ w: 1, h: 12 })
    expect(clampSize(13.4, 1.6)).toEqual({ w: 12, h: 2 })
    expect(clampSize(NaN, NaN)).toEqual({ w: 1, h: 1 })
  })

  it('cleans saved layouts', () => {
    expect(cleanLayout('nope')).toBeUndefined()
    const tiles = cleanLayout([
      {
        key: 'a',
        metrics: ['hr', 'bogus', 'cadence'],
        x: 11,
        y: 0,
        w: 20,
        h: 0,
        bg: '#ff0000',
        fg: 'red',
        colors: [null, 'blue', '#00ff00', '#123456'],
        zoneBar: false,
        targetTint: true,
        align: 'center',
        animation: 'pulse',
        locked: true,
      },
      {
        key: 'a',
        targetTint: 'yes',
        metrics: ['power3s', 'target', 'np', 'tss'],
        x: 0,
        y: 0,
        w: 3,
        h: 1,
      },
      { key: 'c', metrics: ['bogus'], w: 3, h: 1 },
      { key: 'd', metrics: ['hr'], x: 0, y: 3, w: 3, h: 1, align: 'up', animation: 'spin' },
      null,
    ])
    expect(tiles).toEqual([
      {
        key: 'a',
        metrics: ['hr', 'cadence'],
        x: 0,
        y: 0,
        w: 12,
        h: 1,
        bg: '#ff0000',
        colors: [null, '#00ff00'],
        zoneBar: false,
        targetTint: true,
        align: 'center',
        animation: 'pulse',
        locked: true,
      },
      // Overlapped the locked tile: pushed below it. No limit of 3 numbers any more.
      { key: 'a_', metrics: ['power3s', 'target', 'np', 'tss'], x: 0, y: 1, w: 3, h: 1 },
      // Holes close up (gravity).
      { key: 'd', metrics: ['hr'], x: 0, y: 2, w: 3, h: 1 },
    ])
  })

  it('places layouts saved as a list (no places) row by row', () => {
    const tiles = cleanLayout([
      { key: 'a', metrics: ['hr'], w: 6, h: 2 },
      { key: 'b', metrics: ['hr'], w: 9, h: 1 },
      { key: 'c', metrics: ['hr'], w: 6, h: 1 },
    ])!
    expect(at(tiles)).toEqual({ a: [0, 0], b: [0, 2], c: [6, 0] })
  })

  it('moves the old tile choice over', () => {
    const tiles = legacyLayout(['powerTarget', 'time', 'hr', 'kj', 'gone'])
    expect(tiles.map((t) => [t.metrics, t.w, t.x, t.y])).toEqual([
      [['power3s', 'target'], 3, 0, 0],
      [['intervalLeft', 'elapsed', 'total'], 6, 3, 0],
      [['hr'], 3, 9, 0],
      [['kcal'], 3, 0, 1],
    ])
  })

  it('swaps a wide tile in from the edge', () => {
    const tiles = [tile('a', 0, 0), tile('z', 10, 1, 2)]
    expect(at(placeTile(tiles, 'z', { x: 1, y: 0 }))).toEqual({ a: [9, 0], z: [1, 0] })
  })

  it('swaps with a tile of the same place', () => {
    const tiles = [tile('a', 0, 0), tile('b', 3, 0), tile('c', 6, 0)]
    expect(at(placeTile(tiles, 'a', { x: 6, y: 0 }))).toEqual({ a: [6, 0], b: [3, 0], c: [0, 0] })
  })

  it('moves into free space without touching others, and floats up', () => {
    const tiles = [tile('a', 0, 0), tile('b', 3, 0), tile('c', 0, 1)]
    expect(at(placeTile(tiles, 'a', { x: 9, y: 2 }))).toEqual({ a: [9, 0], b: [3, 0], c: [0, 0] })
  })

  it('dragged down, the tiles below move up into its place', () => {
    const tiles = [tile('a', 0, 0, 12), tile('b', 0, 1), tile('c', 3, 1), tile('d', 0, 2)]
    const next = placeTile(tiles, 'a', { y: 1 })
    expect(noOverlaps(next)).toBe(true)
    expect(at(next)).toEqual({ a: [0, 1], b: [0, 0], c: [3, 0], d: [0, 2] })
  })

  it('a locked tile holds up the tiles under it', () => {
    const tiles = [tile('l', 0, 1, 3, 1, { locked: true }), tile('b', 0, 3), tile('c', 3, 3)]
    expect(at(placeTile(tiles, 'c', { x: 6 }))).toEqual({ l: [0, 1], b: [0, 2], c: [6, 0] })
  })

  it('pushes tiles in the way down', () => {
    const tiles = [tile('a', 0, 0, 6), tile('b', 6, 0), tile('c', 9, 0)]
    const next = placeTile(tiles, 'a', { x: 6 })
    expect(noOverlaps(next)).toBe(true)
    expect(at(next)).toEqual({ a: [6, 0], b: [6, 1], c: [9, 1] })
  })

  it('never moves a locked tile, nor onto one', () => {
    const tiles = [tile('a', 0, 0), tile('b', 3, 0, 3, 1, { locked: true }), tile('c', 0, 1, 12)]
    expect(at(placeTile(tiles, 'b', { x: 9 }))).toEqual(at(tiles))
    expect(at(placeTile(tiles, 'a', { x: 3 }))).toEqual(at(tiles))
    expect(at(placeTile(tiles, 'a', { x: 2 }))).toEqual(at(tiles))
    // Pushing c up into b's row is refused; pushing it around b is fine.
    const next = placeTile(tiles, 'c', { y: 0, w: 3 })
    expect(next.find((t) => t.key === 'b')).toMatchObject({ x: 3, y: 0 })
    expect(noOverlaps(next)).toBe(true)
    // A tile pushed down goes past a locked one instead of over it.
    const pushed = placeTile(
      [tile('a', 0, 0), tile('b', 0, 1), tile('l', 0, 2, 3, 1, { locked: true }), tile('z', 6, 0)],
      'z',
      { x: 0, y: 0 },
    )
    expect(noOverlaps(pushed)).toBe(true)
    expect(pushed.find((t) => t.key === 'l')).toMatchObject({ x: 0, y: 2 })
  })

  it('resizes, pushing what it grows into', () => {
    const tiles = [tile('a', 0, 0), tile('b', 3, 0), tile('c', 0, 1)]
    const next = placeTile(tiles, 'a', { w: 6, h: 2 })
    expect(next.find((t) => t.key === 'a')).toMatchObject({ x: 0, y: 0, w: 6, h: 2 })
    expect(noOverlaps(next)).toBe(true)
  })

  it('finds free spots and adds tiles there', () => {
    const tiles = [tile('a', 0, 0, 6), tile('b', 9, 0)]
    expect(findSpot(tiles, 3, 1)).toEqual({ x: 6, y: 0, w: 3, h: 1 })
    expect(findSpot(tiles, 4, 1)).toEqual({ x: 0, y: 1, w: 4, h: 1 })
    expect(addTile(tiles).at(-1)).toMatchObject({ key: 't2', x: 6, y: 0 })
  })

  it('drops empty rows for the screen', () => {
    const tiles = [tile('a', 0, 0), tile('b', 0, 3, 3, 2), tile('c', 3, 6)]
    expect(at(dropEmptyRows(tiles))).toEqual({ a: [0, 0], b: [0, 1], c: [3, 3] })
  })

  it('keeps valid panel styles only', () => {
    expect(cleanPanelStyle(null)).toBeUndefined()
    expect(cleanPanelStyle({ bg: 'red', textScale: 1, axes: true })).toBeUndefined()
    expect(
      cleanPanelStyle({
        bg: '#112233',
        text: '#ffffff',
        textScale: 9,
        next: false,
        nextScale: 0.1,
      }),
    ).toEqual({ bg: '#112233', text: '#ffffff', textScale: 3, next: false, nextScale: 0.5 })
    const tiles = cleanLayout([
      { key: 'p', panel: 'workout', x: 0, y: 0, w: 12, h: 2, style: { ftp: false, legend: 1 } },
    ])!
    expect(tiles[0]!.style).toEqual({ ftp: false })
  })

  it('makes unused keys', () => {
    expect(newTileKey([{ key: 't1' }])).toBe('t2')
    expect(newTileKey([])).toBe('t0')
  })
})

describe('ride preview', () => {
  it('has a workout profile and chart data', () => {
    expect(previewTimeline().at(-1)!.startS + previewTimeline().at(-1)!.durationS).toBe(
      PREVIEW_TOTAL_S,
    )
    const chart = previewChart(30, 200)
    expect(chart[0]).toHaveLength(31)
    expect(chart[2][30]).toBe(110)
    expect(previewChart(5000, 200, 100)[0]).toHaveLength(101)
  })

  it('has a sample inside a hard interval', () => {
    const p = previewRide(PREVIEW_SAMPLE_S, 200)
    expect(p.values.target).toBe(210)
    expect(Math.abs(p.values.power3s - 210)).toBeLessThan(15)
    expect(p.values.intervalLeft).toBe(85)
    expect(p.hot).toBe(false)
  })

  it('knows the step now and next, with the repeat', () => {
    const p = previewRide(600 + 300 + 30, 200)
    expect(p.segment).toMatchObject({ toPct: 1.05, repeat: { index: 2, count: 5 } })
    expect(p.next).toMatchObject({ toPct: 0.5, repeat: { index: 2, count: 5 } })
    expect(previewRide(PREVIEW_TOTAL_S - 1, 200).next).toBeUndefined()
  })

  it('warns before a step change and wraps', () => {
    expect(previewRide(600 + 177, 200).hot).toBe(true)
    expect(previewRide(PREVIEW_TOTAL_S + 5, 200).values.elapsed).toBe(5)
    expect(previewRide(PREVIEW_TOTAL_S - 2, 200).hot).toBe(false)
  })
})
