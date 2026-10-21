import { loadPref, savePref } from './prefs'

const KEY = 'cyclotron.uiScale'

/** Interface size choices; 4K screens running at 100 % scaling need the bigger ones. */
export const UI_SCALES = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const

/** Interface size, applied to the whole window (on top of the OS display scaling). */
class Display {
  scale = $state(loadPref<number>(KEY) ?? 1)

  apply(): void {
    window.cyclotron.app.setZoom(this.scale)
  }

  setScale(scale: number): void {
    if (!UI_SCALES.includes(scale as (typeof UI_SCALES)[number])) return
    this.scale = scale
    savePref(KEY, scale)
    this.apply()
  }
}

export const display = new Display()
