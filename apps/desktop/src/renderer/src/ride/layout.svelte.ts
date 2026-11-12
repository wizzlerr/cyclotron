// The rider's Ride screen tiles (E4-6): layout, editing state and saving. The model and its rules
// live in core (ride/layout.ts); this keeps it in settings and lets the screen edit it.

import {
  clampSize,
  cleanLayout,
  defaultLayout,
  legacyLayout,
  moveTile,
  newTileKey,
  type TileSpec,
} from '@cyclotron/core'
import { loadPref, savePref } from '../lib/prefs'

const KEY = 'cyclotron.rideLayout'
/** The fixed tiles before E4-6 (a list of tile ids), moved over once. */
const LEGACY_KEY = 'cyclotron.rideTiles.v2'

function load(): TileSpec[] {
  const saved = cleanLayout(loadPref<unknown>(KEY))
  if (saved) return saved
  const legacy = loadPref<unknown>(LEGACY_KEY)
  if (Array.isArray(legacy)) {
    const moved = legacyLayout(legacy.filter((x): x is string => typeof x === 'string'))
    if (moved.length > 0) {
      savePref(KEY, moved)
      return moved
    }
  }
  return defaultLayout()
}

class RideLayout {
  tiles = $state.raw<TileSpec[]>(load())
  /** Edit mode on the Ride screen: drag, resize, pick numbers and colours. */
  editing = $state(false)
  /** Key of the tile open in the editor. */
  selected = $state<string | undefined>()

  get selectedTile(): TileSpec | undefined {
    return this.tiles.find((t) => t.key === this.selected)
  }

  startEditing(): void {
    this.editing = true
  }

  stopEditing(): void {
    this.editing = false
    this.selected = undefined
    this.save()
  }

  update(key: string, patch: Partial<Omit<TileSpec, 'key'>>, save = true): void {
    this.tiles = this.tiles.map((t) => {
      if (t.key !== key) return t
      const next = { ...t, ...patch }
      return { ...next, ...clampSize(next.w, next.h) }
    })
    if (save) this.save()
  }

  /** Live while dragging; saved on drop (`save()`). */
  move(key: string, toKey: string): void {
    this.tiles = moveTile(this.tiles, key, toKey)
  }

  add(): void {
    const key = newTileKey(this.tiles)
    this.tiles = [...this.tiles, { key, metrics: ['power3s'], w: 3, h: 1 }]
    this.selected = key
    this.save()
  }

  remove(key: string): void {
    this.tiles = this.tiles.filter((t) => t.key !== key)
    if (this.selected === key) this.selected = undefined
    this.save()
  }

  reset(): void {
    this.tiles = defaultLayout()
    this.selected = undefined
    this.save()
  }

  save(): void {
    savePref(KEY, this.tiles)
  }
}

export const rideLayout = new RideLayout()
