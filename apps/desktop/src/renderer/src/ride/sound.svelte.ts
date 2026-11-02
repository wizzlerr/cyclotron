import { loadPref, savePref } from '../lib/prefs'

// Volume of the ride's beeps (countdown, step change, finish), 0–100 %.

const KEY = 'cyclotron.cueVolume'
const DEFAULT = 80

class Sound {
  volume = $state(loadPref<number>(KEY) ?? DEFAULT)

  setVolume(v: number): void {
    if (!Number.isFinite(v)) return
    this.volume = Math.min(100, Math.max(0, Math.round(v)))
    savePref(KEY, this.volume)
  }
}

export const sound = new Sound()
