// E4-5: which tiles the ride screen shows, in which order.

import { t } from '../i18n/t'
import { loadPref, savePref } from '../lib/prefs'

export type TileId =
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
  'power3s',
  'target',
  'intervalLeft',
  'intervalAvg',
  'hr',
  'cadence',
  'elapsed',
  'np',
  'tss',
  'kcal',
]

const KEY = 'cyclotron.rideTiles'

function load(): TileId[] {
  const saved = loadPref<string[]>(KEY)
  if (!Array.isArray(saved)) return DEFAULT
  const known = new Set<string>(TILES.map((t) => t.id))
  // 'kj' became 'kcal' (2026-10-21).
  return saved.map((id) => (id === 'kj' ? 'kcal' : id)).filter((id) => known.has(id)) as TileId[]
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
    savePref(KEY, ids)
  }
}

export const rideTiles = new RideTiles()
