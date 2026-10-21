// E4-5: which tiles the ride screen shows, in which order.

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
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as string[] | null
    const known = new Set<string>(TILES.map((t) => t.id))
    // 'kj' became 'kcal' (2026-10-21).
    const ids = saved?.map((id) => (id === 'kj' ? 'kcal' : id))
    return (ids?.filter((id) => known.has(id)) as TileId[] | undefined) ?? DEFAULT
  } catch {
    return DEFAULT
  }
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
    try {
      localStorage.setItem(KEY, JSON.stringify(ids))
    } catch {
      // Keeps working for this session.
    }
  }
}

export const rideTiles = new RideTiles()
