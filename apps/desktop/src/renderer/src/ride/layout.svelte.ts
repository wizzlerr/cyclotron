// The rider's Ride screen tiles (E4-6): layout, editing state and saving. The model and its rules
// live in core (ride/layout.ts); this keeps it in settings and lets the screen edit it.

import {
  addPanel,
  addTile,
  cleanLayout,
  defaultLayout,
  legacyLayout,
  placeTile,
  withPanels,
  type PanelId,
  type TilePlace,
  type TileSpec,
} from '@cyclotron/core'
import { loadPref, savePref } from '../lib/prefs'

const KEY = 'cyclotron.rideLayout'
/** The fixed tiles before E4-6 (a list of tile ids), moved over once. */
const LEGACY_KEY = 'cyclotron.rideTiles.v2'
/** Set once the charts became part of the layout (D37), so removing them all is respected. */
const PANELS_KEY = 'cyclotron.rideLayout.panels'

function load(): TileSpec[] {
  const saved = cleanLayout(loadPref<unknown>(KEY))
  if (saved) {
    if (loadPref<boolean>(PANELS_KEY)) return saved
    const moved = withPanels(saved)
    savePref(KEY, moved)
    savePref(PANELS_KEY, true)
    return moved
  }
  savePref(PANELS_KEY, true)
  const legacy = loadPref<unknown>(LEGACY_KEY)
  if (Array.isArray(legacy)) {
    const moved = withPanels(legacyLayout(legacy.filter((x): x is string => typeof x === 'string')))
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

  /** Anything but the place (numbers, colours, lock…). Size and place go through `place`. */
  update(key: string, patch: Partial<Omit<TileSpec, 'key' | keyof TilePlace>>, save = true): void {
    this.tiles = this.tiles.map((t) => (t.key === key ? { ...t, ...patch } : t))
    if (save) this.save()
  }

  /**
   * Moves/resizes a tile, pushing others out of the way. `from` is the layout when the drag
   * started, so a drag back and forth doesn't pile up pushes. Saved on drop (`save()`).
   */
  place(key: string, to: Partial<TilePlace>, from: readonly TileSpec[] = this.tiles): void {
    this.tiles = placeTile(from, key, to)
  }

  add(): void {
    this.tiles = addTile(this.tiles)
    this.selected = this.tiles.at(-1)?.key
    this.save()
  }

  addPanel(panel: PanelId): void {
    this.tiles = addPanel(this.tiles, panel)
    this.selected = this.tiles.find((t) => t.panel === panel)?.key
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
