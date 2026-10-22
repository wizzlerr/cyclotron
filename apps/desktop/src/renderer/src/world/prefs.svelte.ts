import { loadPref, savePref } from '../lib/prefs'
import type { WorldQuality } from './scene'

// The optional virtual world (E16): shown on the Ride screen when on; off by default because the
// app is numbers-first.

const KEY = 'cyclotron.world'

interface Stored {
  enabled?: boolean
  quality?: WorldQuality
}

class WorldPrefs {
  private stored = loadPref<Stored>(KEY) ?? {}
  enabled = $state(this.stored.enabled ?? false)
  quality = $state<WorldQuality>(this.stored.quality ?? 'high')

  setEnabled(on: boolean): void {
    this.enabled = on
    this.save()
  }

  setQuality(q: WorldQuality): void {
    this.quality = q
    this.save()
  }

  private save(): void {
    savePref(KEY, { enabled: this.enabled, quality: this.quality } satisfies Stored)
  }
}

export const worldPrefs = new WorldPrefs()
