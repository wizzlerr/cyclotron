// E4-5: which tiles the ride screen shows, in which order.

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

export const TILES: readonly { id: TileId; label: string }[] = [
  { id: 'power3s', label: 'Power (3 s average)' },
  { id: 'power', label: 'Power (instant)' },
  { id: 'power10s', label: 'Power (10 s average)' },
  { id: 'target', label: 'Target' },
  { id: 'intervalLeft', label: 'Interval time left (workouts)' },
  { id: 'intervalAvg', label: 'Interval average power' },
  { id: 'elapsed', label: 'Elapsed' },
  { id: 'hr', label: 'Heart rate' },
  { id: 'cadence', label: 'Cadence' },
  { id: 'speed', label: 'Speed' },
  { id: 'wkg', label: 'W/kg (3 s)' },
  { id: 'avgPower', label: 'Average power' },
  { id: 'np', label: 'Normalized Power' },
  { id: 'if', label: 'Intensity Factor' },
  { id: 'tss', label: 'TSS' },
  { id: 'kcal', label: 'Calories (kcal)' },
]

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
