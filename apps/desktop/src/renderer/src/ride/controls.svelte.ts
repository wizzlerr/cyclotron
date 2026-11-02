// Ride actions shared by the Ride screen and the ride controls in the side bar
// (components/RideControls.svelte), and run by controller buttons (lib/padmap.svelte.ts).

import { devices } from '../devices/devices.svelte'
import type { PadAction } from '../lib/padmap.svelte'
import { worldPrefs } from '../world/prefs.svelte'
import { ride } from './session.svelte'

export const ERG_STEP_W = 10
export const RESISTANCE_STEP = 5
/** Controller + / − in a workout step: watts on the current target. */
export const PAD_STEP_W = 1

class RideControls {
  ergWatts = $state(150)
  /** Manual resistance (E2-3), 0–100 % of the trainer's range. */
  resistancePct = $state(30)
  /** "End and save?" is showing. */
  confirmEnd = $state(false)

  get status(): string | undefined {
    return ride.state?.status
  }

  get inFreeStep(): boolean {
    const s = ride.state
    return s?.status === 'running' && s.segment?.kind === 'freeride'
  }

  // Manual ERG: before a ride it drives the trainer directly; during a free-ride step it goes
  // through the session so it's recorded and survives pause/resume.
  get manualErgOn(): boolean {
    return ride.active ? ride.manual?.kind === 'erg' : devices.control.kind === 'erg'
  }

  get manualResistanceOn(): boolean {
    return ride.active ? ride.manual?.kind === 'resistance' : devices.control.kind === 'resistance'
  }

  get canResistance(): boolean {
    return devices.trainer?.capabilities().resistance ?? false
  }

  /** The ride panel in the side bar: a workout is loaded and not finished. */
  get panel(): boolean {
    const st = this.status
    return ride.workout !== undefined && st !== undefined && st !== 'finished'
  }

  setErg(watts: number): void {
    this.ergWatts = Math.min(1000, Math.max(50, watts))
    const control = { kind: 'erg', watts: this.ergWatts } as const
    if (ride.active) ride.setManual(control)
    else void devices.setControl(control)
  }

  ergOff(): void {
    if (ride.active) ride.setManual(undefined)
    else void devices.setControl({ kind: 'free' })
  }

  setResistance(pct: number): void {
    this.resistancePct = Math.min(100, Math.max(0, pct))
    const control = { kind: 'resistance', level: this.resistancePct } as const
    if (ride.active) ride.setManual(control)
    else void devices.setControl(control)
  }

  playPause(): void {
    const st = this.status
    if (st === 'ready' && devices.trainer) ride.start()
    else if (st === 'running') ride.pause()
    else if (st === 'paused') ride.resume()
  }

  skip(): void {
    if (ride.active && !ride.isFreeRide) ride.skip()
  }

  /** First call asks, the second ends (a controller button pressed twice). */
  end(): void {
    if (!ride.active) return
    if (!this.confirmEnd) {
      this.confirmEnd = true
      return
    }
    this.confirmEnd = false
    ride.end()
  }

  /** + (1) or − (−1): ERG or resistance when on, else the workout target. */
  step(dir: 1 | -1): void {
    if (this.manualErgOn) this.setErg(this.ergWatts + dir * ERG_STEP_W)
    else if (this.manualResistanceOn) {
      this.setResistance(this.resistancePct + dir * RESISTANCE_STEP)
    } else if (ride.active && !this.inFreeStep) ride.nudgeTarget(dir * PAD_STEP_W)
    // Free riding: + / − switch ERG on, a step up or down from the last target.
    else this.setErg(this.ergWatts + dir * ERG_STEP_W)
  }

  toggleErg(): void {
    if (this.manualErgOn) this.ergOff()
    else if (!ride.active || this.inFreeStep) this.setErg(this.ergWatts)
  }

  run(action: PadAction): void {
    if (action !== 'end') this.confirmEnd = false
    switch (action) {
      case 'playPause':
        return this.playPause()
      case 'skip':
        return this.skip()
      case 'end':
        return this.end()
      case 'plus':
        return this.step(1)
      case 'minus':
        return this.step(-1)
      case 'erg':
        return this.toggleErg()
      case 'mute':
        ride.muted = !ride.muted
        return
      case 'world':
        return worldPrefs.setEnabled(!worldPrefs.enabled)
      case 'none':
        return
    }
  }
}

export const controls = new RideControls()
