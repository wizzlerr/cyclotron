// The rider's own Ride screen tiles (E4-6): which numbers each tile shows, its size on a 12-column
// grid and its colours. Order in the list is order on the screen (the grid packs densely).

/** Every number a tile can show. Codes, not words: the UI names them (i18n). */
export const METRIC_IDS = [
  // Power
  'power3s',
  'power',
  'power10s',
  'target',
  'wkg',
  'intervalAvg',
  'avgPower',
  'maxPower',
  'np',
  'if',
  'tss',
  'kcal',
  // Heart rate, cadence, speed
  'hr',
  'avgHr',
  'maxHr',
  'cadence',
  'avgCadence',
  'speed',
  // Time
  'intervalLeft',
  'elapsed',
  'total',
  'workoutLeft',
  // Route
  'grade',
  'distance',
  'toGo',
  'elevation',
  'climbed',
] as const

export type MetricId = (typeof METRIC_IDS)[number]

export const GRID_COLUMNS = 12
export const MAX_TILE_ROWS = 4
/** Numbers in one tile ("power / target", "interval | elapsed | total"). */
export const MAX_TILE_METRICS = 3

export interface TileSpec {
  /** Stable key for this tile (not shown). */
  key: string
  metrics: MetricId[]
  /** Width in grid columns (1–12) and height in rows (1–4). */
  w: number
  h: number
  /** CSS colours (#rrggbb); undefined = the theme's. */
  bg?: string
  fg?: string
  /** Colour bar of the power / heart-rate zone; on unless turned off. */
  zoneBar?: boolean
}

const isMetric = (m: unknown): m is MetricId =>
  typeof m === 'string' && (METRIC_IDS as readonly string[]).includes(m)

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

export function clampSize(w: number, h: number): { w: number; h: number } {
  return {
    w: clamp(Math.round(w) || 1, 1, GRID_COLUMNS),
    h: clamp(Math.round(h) || 1, 1, MAX_TILE_ROWS),
  }
}

const HEX = /^#[0-9a-f]{6}$/i

/** A layout read back from settings: drops anything unknown or broken, never throws. */
export function cleanLayout(raw: unknown): TileSpec[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<string>()
  const out: TileSpec[] = []
  for (const t of raw as Partial<TileSpec>[]) {
    if (!t || typeof t !== 'object') continue
    const metrics = (Array.isArray(t.metrics) ? t.metrics : []).filter(isMetric)
    if (metrics.length === 0) continue
    let key = typeof t.key === 'string' && t.key ? t.key : `t${out.length}`
    while (seen.has(key)) key += '_'
    seen.add(key)
    const tile: TileSpec = {
      key,
      metrics: metrics.slice(0, MAX_TILE_METRICS),
      ...clampSize(Number(t.w), Number(t.h)),
    }
    if (typeof t.bg === 'string' && HEX.test(t.bg)) tile.bg = t.bg
    if (typeof t.fg === 'string' && HEX.test(t.fg)) tile.fg = t.fg
    if (t.zoneBar === false) tile.zoneBar = false
    out.push(tile)
  }
  return out
}

/** The old fixed tiles (Settings → Ride screen checkboxes, `cyclotron.rideTiles.v2`). */
const LEGACY: Record<string, { metrics: MetricId[]; w: number }> = {
  powerTarget: { metrics: ['power3s', 'target'], w: 3 },
  avgNp: { metrics: ['avgPower', 'np'], w: 3 },
  time: { metrics: ['intervalLeft', 'elapsed', 'total'], w: 6 },
  elapsed: { metrics: ['elapsed', 'total'], w: 3 },
  kj: { metrics: ['kcal'], w: 3 },
}

/** Turns the old tile choice into a layout, in the same order. */
export function legacyLayout(ids: readonly string[]): TileSpec[] {
  const out: TileSpec[] = []
  for (const id of ids) {
    const known = LEGACY[id] ?? (isMetric(id) ? { metrics: [id], w: 3 } : undefined)
    if (known) out.push({ key: `t${out.length}`, metrics: [...known.metrics], w: known.w, h: 1 })
  }
  return out
}

/** What a new rider sees: the old default tiles, packed into two full rows. */
export function defaultLayout(): TileSpec[] {
  const tiles: [MetricId[], number][] = [
    [['power3s', 'target'], 3],
    [['intervalLeft', 'elapsed', 'total'], 6],
    [['hr'], 3],
    [['avgPower', 'np'], 3],
    [['intervalAvg'], 3],
    [['cadence'], 2],
    [['tss'], 2],
    [['kcal'], 2],
  ]
  return tiles.map(([metrics, w], i) => ({ key: `t${i}`, metrics, w, h: 1 }))
}

/** Moves the tile `key` to where `beforeKey` is now (drag and drop). */
export function moveTile(tiles: readonly TileSpec[], key: string, toKey: string): TileSpec[] {
  const from = tiles.findIndex((t) => t.key === key)
  const to = tiles.findIndex((t) => t.key === toKey)
  if (from < 0 || to < 0 || from === to) return [...tiles]
  const out = [...tiles]
  const [moved] = out.splice(from, 1)
  out.splice(to, 0, moved!)
  return out
}

/** A key not used by any tile yet. */
export function newTileKey(tiles: readonly TileSpec[]): string {
  const used = new Set(tiles.map((t) => t.key))
  for (let i = tiles.length; ; i++) if (!used.has(`t${i}`)) return `t${i}`
}
