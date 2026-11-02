import { localDate, parseZwo, type Workout } from '@cyclotron/core'
import type { IntervalsStatus, PlannedWorkout } from '../../../shared/api'

export interface PlannedRide extends PlannedWorkout {
  workout: Workout
}

/** Workout id of a planned intervals.icu ride; main pairs the upload with the event by it. */
export const plannedId = (eventId: number): string => `icu.${eventId}`

/** Rides planned on the intervals.icu calendar (E18), fetched and cached by main. */
class Planned {
  rides = $state.raw<PlannedRide[]>([])
  status = $state.raw<IntervalsStatus | undefined>()
  busy = $state(false)
  private loaded: Promise<void> | undefined

  /** Today and later, for the Home card. */
  get upcoming(): PlannedRide[] {
    const today = localDate(Date.now(), -new Date().getTimezoneOffset())
    return this.rides.filter((r) => r.date >= today)
  }

  /** The cached list, without going online (enough to continue an interrupted ride). */
  load(): Promise<void> {
    this.loaded ??= this.refresh('none')
    return this.loaded
  }

  async refresh(mode: 'none' | 'auto' | 'force' = 'auto'): Promise<void> {
    this.busy = true
    try {
      const { planned, status } = await window.cyclotron.intervals.planned(mode)
      this.status = status
      this.rides = planned.flatMap((p) => {
        try {
          const w = parseZwo(p.zwo, plannedId(p.eventId))
          const workout: Workout = {
            ...w,
            name: p.name || w.name,
            description: p.description ?? w.description,
            source: 'intervals',
          }
          return [{ ...p, workout }]
        } catch {
          // Not a workout Cyclotron can play (e.g. only text); skip it.
          return []
        }
      })
    } finally {
      this.busy = false
    }
  }

  find(id: string): Workout | undefined {
    return this.rides.find((r) => r.workout.id === id)?.workout
  }
}

export const planned = new Planned()
