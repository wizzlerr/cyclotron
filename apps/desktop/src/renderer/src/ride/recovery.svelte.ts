import type { RideSample } from '@cyclotron/core'
import type { StoredRide } from '../../../shared/api'
import { errorText } from '../i18n/errors'
import { t } from '../i18n/t'
import { finalizeRide } from './recorder'
import { ride } from './session.svelte'

type Notice =
  | { kind: 'empty' }
  | { kind: 'saved'; path: string }
  | { kind: 'fitFailed'; error: string }
  | { kind: 'failed'; error: string }
  | { kind: 'cantContinue' }

/**
 * E5-1 crash recovery: a ride left 'active' (the app crashed or was closed mid-ride) can be
 * continued where it stopped, saved from its recorded samples, or discarded.
 */
class Recovery {
  found = $state.raw<{ ride: StoredRide; samples: RideSample[] } | undefined>()
  busy = $state(false)
  private notice = $state<Notice | undefined>()

  /** Result of the last save, in the UI language. */
  get message(): string | undefined {
    const n = this.notice
    const r = t().app.recovery
    if (!n) return undefined
    if (n.kind === 'empty') return r.empty
    if (n.kind === 'saved') return r.saved(n.path)
    if (n.kind === 'cantContinue') return r.cantContinue
    return n.kind === 'fitFailed' ? r.fitFailed(n.error) : r.failed(n.error)
  }

  async check(): Promise<void> {
    this.found = (await window.cyclotron.rides.unfinished()) ?? undefined
  }

  /** Carries on with the ride; false when its workout or route no longer exists. */
  async continue(): Promise<boolean> {
    const found = this.found
    if (!found || this.busy) return false
    this.busy = true
    try {
      const ok = await ride.continueRide(found.ride, found.samples)
      if (ok) {
        this.found = undefined
        this.notice = undefined
      } else {
        this.notice = { kind: 'cantContinue' }
      }
      return ok
    } finally {
      this.busy = false
    }
  }

  async save(): Promise<void> {
    const found = this.found
    if (!found || this.busy) return
    this.busy = true
    try {
      if (found.samples.length === 0) {
        await window.cyclotron.rides.discard(found.ride.id)
        this.notice = { kind: 'empty' }
      } else {
        const r = await finalizeRide(found.ride.id, found.ride, found.samples)
        this.notice = r.fitPath
          ? { kind: 'saved', path: r.fitPath }
          : { kind: 'fitFailed', error: r.fitError ?? '' }
      }
      this.found = undefined
    } catch (e) {
      this.notice = { kind: 'failed', error: errorText(e) }
    } finally {
      this.busy = false
    }
  }

  async discard(): Promise<void> {
    const found = this.found
    if (!found || this.busy) return
    await window.cyclotron.rides.discard(found.ride.id)
    this.found = undefined
    this.notice = undefined
  }
}

export const recovery = new Recovery()
