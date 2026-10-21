import type { RideSample } from '@cyclotron/core'
import type { StoredRide } from '../../../shared/api'
import { finalizeRide } from './recorder'

/**
 * E5-1 crash recovery: a ride left 'active' (the app crashed or was closed mid-ride) can be saved
 * from its recorded samples or discarded. Resuming the workout itself isn't supported yet.
 */
class Recovery {
  found = $state.raw<{ ride: StoredRide; samples: RideSample[] } | undefined>()
  busy = $state(false)
  message = $state<string | undefined>()

  async check(): Promise<void> {
    this.found = (await window.cyclotron.rides.unfinished()) ?? undefined
  }

  async save(): Promise<void> {
    const found = this.found
    if (!found || this.busy) return
    this.busy = true
    try {
      if (found.samples.length === 0) {
        await window.cyclotron.rides.discard(found.ride.id)
        this.message = 'The unfinished ride had no data and was removed.'
      } else {
        const r = await finalizeRide(found.ride.id, found.ride, found.samples)
        this.message = r.fitPath
          ? `Saved ${r.fitPath}`
          : `Saved, but the FIT file failed: ${r.fitError}`
      }
      this.found = undefined
    } catch (e) {
      this.message = `Saving failed: ${e instanceof Error ? e.message : String(e)}`
    } finally {
      this.busy = false
    }
  }

  async discard(): Promise<void> {
    const found = this.found
    if (!found || this.busy) return
    await window.cyclotron.rides.discard(found.ride.id)
    this.found = undefined
    this.message = undefined
  }
}

export const recovery = new Recovery()
