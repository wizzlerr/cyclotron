// E4-5: which tiles the ride screen shows, in which order.

import { t } from '../i18n/t'
import { loadPref, savePref } from '../lib/prefs'

export type TileId =
  | 'powerTarget'
  | 'avgNp'
  | 'time'
  | 'power3s'
  | 'power'
  | 'power10s'
  | 'target'
  | 'intervalLeft'
  | 'intervalAvg'
  | 'elapsed'
  | 'hr'
  | 'cadence'
  | 'speed'
  | 'wkg'
  | 'avgPower'
  | 'np'
  | 'if'
  | 'tss'
  | 'kcal'

const TILE_IDS: readonly TileId[] = [
  // Combined tiles (2026-11-02): several numbers in one, so the screen has fewer, wider tiles.
  'powerTarget',
  'avgNp',
  'time',
  'power3s',
  'power',
  'power10s',
  'target',
  'intervalLeft',
  'intervalAvg',
  'elapsed',
  'hr',
  'cadence',
  'speed',
  'wkg',
  'avgPower',
  'np',
  'if',
  'tss',
  'kcal',
]

/** Every tile, in layout order. `label` is the long name in the UI language (read at render). */
export const TILES: readonly { id: TileId; readonly label: string }[] = TILE_IDS.map((id) => ({
  id,
  get label() {
    return t().ride.tiles[id].long
  },
}))

const DEFAULT: TileId[] = [
  'powerTarget',
  'avgNp',
  'time',
  'intervalAvg',
  'hr',
  'cadence',
  'tss',
  'kcal',
]

const KEY = 'cyclotron.rideTiles'
/** Set once the saved choice has been moved to the combined tiles. */
const KEY_V2 = 'cyclotron.rideTiles.v2'

const catalogueOrder = (ids: TileId[]): TileId[] => TILE_IDS.filter((id) => ids.includes(id))

/**
 * Moves a choice saved before the combined tiles over to them: power + target, average power or
 * NP, interval left or elapsed each become one tile.
 */
export function combineTiles(ids: TileId[]): TileId[] {
  const has = (id: TileId): boolean => ids.includes(id)
  let out = [...ids]
  const swap = (from: TileId[], to: TileId): void => {
    out = [...out.filter((id) => !from.includes(id)), to]
  }
  if (has('power3s') && has('target')) swap(['power3s', 'target'], 'powerTarget')
  if (has('avgPower') || has('np')) swap(['avgPower', 'np'], 'avgNp')
  if (has('intervalLeft') || has('elapsed')) swap(['intervalLeft', 'elapsed'], 'time')
  return catalogueOrder(out)
}

function load(): TileId[] {
  const known = new Set<string>(TILE_IDS)
  const clean = (saved: string[]): TileId[] =>
    // 'kj' became 'kcal' (2026-10-21).
    saved.map((id) => (id === 'kj' ? 'kcal' : id)).filter((id) => known.has(id)) as TileId[]
  const v2 = loadPref<string[]>(KEY_V2)
  if (Array.isArray(v2)) return catalogueOrder(clean(v2))
  const saved = loadPref<string[]>(KEY)
  if (!Array.isArray(saved)) return DEFAULT
  const moved = combineTiles(clean(saved))
  savePref(KEY_V2, moved)
  return moved
}

class RideTiles {
  shown = $state.raw<TileId[]>(load())

  toggle(id: TileId): void {
    // Keep catalogue order so the layout stays predictable.
    const next = this.shown.includes(id)
      ? this.shown.filter((x) => x !== id)
      : TILES.map((t) => t.id).filter((x) => x === id || this.shown.includes(x))
    this.set(next)
  }

  reset(): void {
    this.set(DEFAULT)
  }

  private set(ids: TileId[]): void {
    this.shown = ids
    savePref(KEY_V2, ids)
  }
}

export const rideTiles = new RideTiles()
