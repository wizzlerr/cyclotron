// E3-6: short beeps before and at step changes. Web Audio, so no sound files to ship.
import { sound } from './sound.svelte'

let ctx: AudioContext | undefined
/** Gain at 100 %; the old fixed level (0.2) is 60 %. */
const MAX_GAIN = 0.33

function tone(freqHz: number, durationMs: number, delayMs = 0): void {
  const level = (sound.volume / 100) * MAX_GAIN
  if (level <= 0) return
  ctx ??= new AudioContext()
  const at = ctx.currentTime + delayMs / 1000
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = freqHz
  gain.gain.setValueAtTime(level, at)
  gain.gain.exponentialRampToValueAtTime(0.001, at + durationMs / 1000)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + durationMs / 1000)
}

/** 3-2-1 countdown tick. */
export const countdownCue = (): void => tone(660, 120)

/** A new step starts. */
export const stepCue = (): void => tone(990, 300)

/** Workout complete. */
export const finishCue = (): void => {
  tone(660, 150)
  tone(880, 150, 180)
  tone(1100, 300, 360)
}
