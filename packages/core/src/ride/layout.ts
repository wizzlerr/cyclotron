// The rider's own Ride screen tiles (E4-6): which numbers each tile shows, where it sits on a
// 12-column grid (column x, row y, width w, height h), its colours, alignment and animation.
// Tiles fall upwards to fill holes (gravity); dropping a tile on others swaps or pushes them.
// Locked tiles never move.

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
  // Workout step texts
  'step',
  'stepTarget',
  'stepRepeat',
  'nextStep',
] as const

export type MetricId = (typeof METRIC_IDS)[number]

/** Values that are words, not numbers: the step now ("Steady 80 %"), its target ("80 %"), its
 * place in a repeat ("3/8") and the next step. The UI words them. */
export const TEXT_METRIC_IDS = ['step', 'stepTarget', 'stepRepeat', 'nextStep'] as const
export type TextMetricId = (typeof TEXT_METRIC_IDS)[number]
export type NumericMetricId = Exclude<MetricId, TextMetricId>

/**
 * The big parts of the Ride screen, placed on the same grid as the number tiles: workout profile
 * (with the next step), live chart, route profile, route map and the virtual world.
 */
export const PANEL_IDS = ['workout', 'chart', 'route', 'map', 'world'] as const
export type PanelId = (typeof PANEL_IDS)[number]

export const GRID_COLUMNS = 12
export const MAX_TILE_ROWS = 12
/** Rows the layout may reach (a sanity bound for saved layouts, not a design limit). */
export const MAX_GRID_ROWS = 40
/** Numbers in one tile: as many as the rider wants; this only bounds broken saved layouts. */
export const MAX_TILE_METRICS = 12

export const TILE_ALIGNS = ['left', 'center', 'right'] as const
export type TileAlign = (typeof TILE_ALIGNS)[number]

/**
 * Optional motion: `count` rolls numbers to their new value, `pulse` bumps the numbers when they
 * change, `glow` makes the tile breathe in its zone colour.
 */
export const TILE_ANIMATIONS = ['count', 'pulse', 'glow'] as const
export type TileAnimation = (typeof TILE_ANIMATIONS)[number]

export interface TileSpec {
  /** Stable key for this tile (not shown). */
  key: string
  /** A chart or other part of the screen instead of numbers (then `metrics` is empty). */
  panel?: PanelId
  /** Panels only: background, texts and which parts show. */
  style?: PanelStyle
  metrics: MetricId[]
  /** Column (0–11) and row (0…) of the top-left corner. */
  x: number
  y: number
  /** Width in grid columns (1–12) and height in rows (1–12). */
  w: number
  h: number
  /** CSS colours (#rrggbb); undefined = the theme's. */
  bg?: string
  fg?: string
  /** One colour per number (same index as `metrics`); null = the tile's colour. */
  colors?: (string | null)[]
  /** Colour bar of the power / heart-rate zone; on unless turned off. */
  zoneBar?: boolean
  /** Left unless set. */
  align?: TileAlign
  animation?: TileAnimation
  /** Stays where it is: can't be dragged or resized, and other tiles never push it. */
  locked?: boolean
}

export type TilePlace = Pick<TileSpec, 'x' | 'y' | 'w' | 'h'>

/**
 * How a panel looks (unset = default). Texts: colour and size of the axis numbers and titles;
 * `axes`, `titles`, `ftp`, `next`, `legend` turn those parts off when false. `next` is the line
 * under the workout profile ("Next in 0:24: …"), with its own colour and size.
 */
export interface PanelStyle {
  bg?: string
  text?: string
  /** 0.5–3 × the normal text size. */
  textScale?: number
  axes?: false
  titles?: false
  ftp?: false
  next?: false
  nextColor?: string
  nextScale?: number
  legend?: false
}

const SCALE_MIN = 0.5
const SCALE_MAX = 3

/** A panel style read back from settings: keeps only what is valid; undefined when empty. */
export function cleanPanelStyle(raw: unknown): PanelStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const out: PanelStyle = {}
  const hex = (v: unknown): string | undefined =>
    typeof v === 'string' && HEX.test(v) ? v : undefined
  const scale = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v)
      ? Math.round(clamp(v, SCALE_MIN, SCALE_MAX) * 100) / 100
      : undefined
  const bg = hex(r.bg)
  if (bg) out.bg = bg
  const text = hex(r.text)
  if (text) out.text = text
  const textScale = scale(r.textScale)
  if (textScale !== undefined && textScale !== 1) out.textScale = textScale
  for (const k of ['axes', 'titles', 'ftp', 'next', 'legend'] as const)
    if (r[k] === false) out[k] = false
  const nextColor = hex(r.nextColor)
  if (nextColor) out.nextColor = nextColor
  const nextScale = scale(r.nextScale)
  if (nextScale !== undefined && nextScale !== 1) out.nextScale = nextScale
  return Object.keys(out).length > 0 ? out : undefined
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

/** A place that fits the grid: size clamped, then x so the tile stays inside the 12 columns. */
export function clampPlace(p: TilePlace): TilePlace {
  const { w, h } = clampSize(p.w, p.h)
  return {
    w,
    h,
    x: clamp(Math.round(p.x) || 0, 0, GRID_COLUMNS - w),
    y: clamp(Math.round(p.y) || 0, 0, MAX_GRID_ROWS - h),
  }
}

export const overlaps = (a: TilePlace, b: TilePlace): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

const fitsAmong = (p: TilePlace, others: readonly TilePlace[]): boolean =>
  others.every((o) => !overlaps(p, o))

/** First free place for a w × h tile, row by row from the top. */
export function findSpot(tiles: readonly TilePlace[], w: number, h: number): TilePlace {
  const size = clampSize(w, h)
  for (let y = 0; ; y++)
    for (let x = 0; x + size.w <= GRID_COLUMNS; x++) {
      const p = { x, y, ...size }
      if (fitsAmong(p, tiles)) return p
    }
}

/** Rows the layout uses. */
export const layoutRows = (tiles: readonly TilePlace[]): number =>
  tiles.reduce((n, t) => Math.max(n, t.y + t.h), 0)

/**
 * Settles tiles that overlap: locked tiles first (in list order), then the others top to bottom,
 * each pushed down from its own place until it is free. Keeps the list order.
 */
function settle<T extends TileSpec>(tiles: readonly T[], fixed: ReadonlySet<string>): T[] {
  const placed: TilePlace[] = []
  const out = new Map<string, T>()
  const first = tiles.filter((t) => fixed.has(t.key))
  for (const t of first) {
    out.set(t.key, t)
    placed.push(t)
  }
  const rest = tiles
    .filter((t) => !fixed.has(t.key))
    .map((t, i) => ({ t, i }))
    .sort((a, b) => a.t.y - b.t.y || a.t.x - b.t.x || a.i - b.i)
  for (const { t } of rest) {
    let y = t.y
    while (!fitsAmong({ ...t, y }, placed)) y++
    const moved = y === t.y ? t : { ...t, y }
    out.set(t.key, moved)
    placed.push(moved)
  }
  return tiles.map((t) => out.get(t.key)!)
}

const lockedKeys = (tiles: readonly TileSpec[]): Set<string> =>
  new Set(tiles.filter((t) => t.locked).map((t) => t.key))

/**
 * Gravity: every tile that isn't locked moves up as far as it can (top to bottom), so the screen
 * has no holes. Locked tiles stay put and hold up what is under them. Keeps the list order.
 */
export function compactTiles<T extends TileSpec>(tiles: readonly T[]): T[] {
  const placed: TilePlace[] = tiles.filter((t) => t.locked)
  const out = new Map<string, T>(tiles.filter((t) => t.locked).map((t) => [t.key, t]))
  const rest = tiles
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !t.locked)
    .sort((a, b) => a.t.y - b.t.y || a.t.x - b.t.x || a.i - b.i)
  for (const { t } of rest) {
    let y = t.y
    while (y > 0 && fitsAmong({ ...t, y: y - 1 }, placed)) y--
    const moved = y === t.y ? t : { ...t, y }
    out.set(t.key, moved)
    placed.push(moved)
  }
  return tiles.map((t) => out.get(t.key)!)
}

/**
 * Moves and/or resizes tile `key` to `to` (drag and drop). Returns the tiles unchanged when the
 * tile is locked or the new place covers a locked tile. Tiles it lands on move into the place it
 * left when they fit there (one tile swaps; dragged down, the tiles below move up), anything else
 * in the way is pushed down, then everything settles upwards (`compactTiles`).
 */
export function placeTile(
  tiles: readonly TileSpec[],
  key: string,
  to: Partial<TilePlace>,
): TileSpec[] {
  const tile = tiles.find((t) => t.key === key)
  if (!tile || tile.locked) return [...tiles]
  const place = clampPlace({ ...pick(tile), ...to })
  if (
    !fitsAmong(
      place,
      tiles.filter((t) => t.locked),
    )
  )
    return [...tiles]
  const moved = { ...tile, ...place }
  let next = tiles.map((t) => (t.key === key ? moved : t))

  const resizing = to.w !== undefined || to.h !== undefined
  const hits = next.filter((t) => t.key !== key && !t.locked && overlaps(t, moved))
  if (!resizing && hits.length > 0) {
    const down = place.y > tile.y
    for (const hit of hits) {
      const spot =
        hits.length === 1
          ? { x: Math.min(tile.x, GRID_COLUMNS - hit.w), y: tile.y }
          : down
            ? { x: hit.x, y: tile.y }
            : undefined
      if (!spot) continue
      const swapped = { ...hit, ...spot }
      if (
        fitsAmong(
          swapped,
          next.filter((t) => t.key !== hit.key),
        )
      )
        next = next.map((t) => (t.key === hit.key ? swapped : t))
    }
  }
  return compactTiles(settle(next, new Set([...lockedKeys(next), key])))
}

const pick = (t: TilePlace): TilePlace => ({ x: t.x, y: t.y, w: t.w, h: t.h })

/** Removes rows no tile covers (e.g. tiles hidden before a ride), so the screen has no holes. */
export function dropEmptyRows<T extends TilePlace>(tiles: readonly T[]): T[] {
  const used = new Set<number>()
  for (const t of tiles) for (let r = t.y; r < t.y + t.h; r++) used.add(r)
  const rows = [...used].sort((a, b) => a - b)
  const index = new Map(rows.map((r, i) => [r, i]))
  return tiles.map((t) => {
    const y = index.get(t.y) ?? t.y
    return y === t.y ? t : { ...t, y }
  })
}

/** A new tile at the first free place. */
export function addTile(tiles: readonly TileSpec[], metrics: MetricId[] = ['power3s']): TileSpec[] {
  const key = newTileKey(tiles)
  return [...tiles, { key, metrics, ...findSpot(tiles, 3, 1) }]
}

const HEX = /^#[0-9a-f]{6}$/i
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

/**
 * A layout read back from settings: drops anything unknown or broken, never throws. Layouts saved
 * before tiles had places (a list in screen order) are packed row by row in that order.
 */
export function cleanLayout(raw: unknown): TileSpec[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<string>()
  const panels = new Set<PanelId>()
  const out: TileSpec[] = []
  let placed = true
  for (const t of raw as Partial<Record<keyof TileSpec, unknown>>[]) {
    if (!t || typeof t !== 'object') continue
    if (t.panel !== undefined) {
      // One of each panel; unknown ones (from a newer version) are dropped.
      const panel = t.panel as PanelId
      if (!(PANEL_IDS as readonly unknown[]).includes(panel) || panels.has(panel)) continue
      panels.add(panel)
      let key = typeof t.key === 'string' && t.key ? t.key : `t${out.length}`
      while (seen.has(key)) key += '_'
      seen.add(key)
      const x = num(t.x)
      const y = num(t.y)
      if (x === undefined || y === undefined) placed = false
      const tile: TileSpec = {
        key,
        panel,
        metrics: [],
        ...clampPlace({ x: x ?? 0, y: y ?? 0, w: Number(t.w), h: Number(t.h) }),
      }
      if (t.locked === true) tile.locked = true
      const style = cleanPanelStyle(t.style)
      if (style) tile.style = style
      out.push(tile)
      continue
    }
    // Colours go with their numbers, so unknown numbers drop their colour too.
    const rawColors: unknown[] = Array.isArray(t.colors) ? t.colors : []
    const kept = (Array.isArray(t.metrics) ? (t.metrics as unknown[]) : [])
      .map((m, i) => ({ m, c: rawColors[i] }))
      .filter((x): x is { m: MetricId; c: unknown } => isMetric(x.m))
      .slice(0, MAX_TILE_METRICS)
    const metrics = kept.map((x) => x.m)
    if (metrics.length === 0) continue
    let key = typeof t.key === 'string' && t.key ? t.key : `t${out.length}`
    while (seen.has(key)) key += '_'
    seen.add(key)
    const x = num(t.x)
    const y = num(t.y)
    if (x === undefined || y === undefined) placed = false
    const tile: TileSpec = {
      key,
      metrics,
      ...clampPlace({ x: x ?? 0, y: y ?? 0, w: Number(t.w), h: Number(t.h) }),
    }
    if (typeof t.bg === 'string' && HEX.test(t.bg)) tile.bg = t.bg
    if (typeof t.fg === 'string' && HEX.test(t.fg)) tile.fg = t.fg
    const colors = kept.map(({ c }) => (typeof c === 'string' && HEX.test(c) ? c : null))
    if (colors.some((c) => c !== null)) tile.colors = colors
    if (t.zoneBar === false) tile.zoneBar = false
    if (t.align === 'center' || t.align === 'right') tile.align = t.align
    if ((TILE_ANIMATIONS as readonly unknown[]).includes(t.animation))
      tile.animation = t.animation as TileAnimation
    if (t.locked === true) tile.locked = true
    out.push(tile)
  }
  if (!placed) return packTiles(out)
  return compactTiles(settle(out, lockedKeys(out)))
}

/** Places tiles row by row in list order, each at the first free place. */
export function packTiles(tiles: readonly TileSpec[]): TileSpec[] {
  const out: TileSpec[] = []
  for (const t of tiles) out.push({ ...t, ...findSpot(out, t.w, t.h) })
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
    if (known)
      out.push({ key: `t${out.length}`, metrics: [...known.metrics], x: 0, y: 0, w: known.w, h: 1 })
  }
  return packTiles(out)
}

/** Default sizes of a panel added by hand. */
export const PANEL_SIZE: Record<PanelId, { w: number; h: number }> = {
  workout: { w: 12, h: 2 },
  chart: { w: 12, h: 3 },
  route: { w: 9, h: 2 },
  map: { w: 3, h: 2 },
  world: { w: 12, h: 3 },
}

const tileAt = (key: string, metrics: MetricId[], x: number, y: number, w: number): TileSpec => ({
  key,
  metrics,
  x,
  y,
  w,
  h: 1,
})
const panelAt = (key: string, panel: PanelId, x: number, y: number): TileSpec => ({
  key,
  panel,
  metrics: [],
  x,
  y,
  ...PANEL_SIZE[panel],
})

/**
 * The screen below the number tiles, as it was before panels could be moved: route numbers (only
 * on routes), the world (only when on), route profile and map, workout profile, live chart. Rows
 * from 0; keys start at `n`.
 */
function defaultPanels(n: number): TileSpec[] {
  return [
    tileAt(`t${n}`, ['grade', 'distance', 'toGo', 'elevation', 'climbed'], 0, 0, 12),
    panelAt(`t${n + 1}`, 'world', 0, 1),
    panelAt(`t${n + 2}`, 'route', 0, 4),
    panelAt(`t${n + 3}`, 'map', 9, 4),
    panelAt(`t${n + 4}`, 'workout', 0, 6),
    panelAt(`t${n + 5}`, 'chart', 0, 8),
  ]
}

/** What a new rider sees: the old default tiles in two full rows, then the panels. */
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
  const top = packTiles(tiles.map(([metrics, w], i) => tileAt(`t${i}`, metrics, 0, 0, w)))
  return withPanels(top)
}

/**
 * A layout from before panels (numbers only) with the panels added under its tiles, laid out as
 * they used to be. A layout that has any panel is returned as is.
 */
export function withPanels(tiles: readonly TileSpec[]): TileSpec[] {
  if (tiles.some((t) => t.panel)) return [...tiles]
  const below = layoutRows(tiles)
  const used = new Set(tiles.map((t) => t.key))
  let n = tiles.length
  while ([0, 1, 2, 3, 4, 5].some((i) => used.has(`t${n + i}`))) n++
  return [...tiles, ...defaultPanels(n).map((t) => ({ ...t, y: t.y + below }))]
}

/** Adds a panel at the bottom, in its default size. */
export function addPanel(tiles: readonly TileSpec[], panel: PanelId): TileSpec[] {
  if (tiles.some((t) => t.panel === panel)) return [...tiles]
  const { w, h } = PANEL_SIZE[panel]
  const key = newTileKey(tiles)
  return [...tiles, { key, panel, metrics: [], x: 0, y: layoutRows(tiles), w, h }]
}

/** A key not used by any tile yet. */
export function newTileKey(tiles: readonly { key: string }[]): string {
  const used = new Set(tiles.map((t) => t.key))
  for (let i = tiles.length; ; i++) if (!used.has(`t${i}`)) return `t${i}`
}
