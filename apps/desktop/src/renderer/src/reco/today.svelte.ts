import {
  recommend,
  type Candidate,
  type DailyLoad,
  type Recommendation,
  type RideRecord,
} from '@cyclotron/core'
import type { RecoRide } from '../../../shared/api'
import { localToday } from '../lib/today'
import { profile } from '../profile.svelte'
import { library } from '../workouts/library.svelte'

// Today's recommendation (E11-6): ride history from main, the engine from core. Recomputed when
// the profile, the time chosen or the library changes; history is reloaded by `refresh()`.

/** History the engine looks at: levels need a few months, everything else 4 weeks. */
const HISTORY_DAYS = 120

class Today {
  /** Time for today's ride; starts from the profile, the Today card can change it. */
  minutes = $state(profile.minutesPerRide)
  error = $state<string | undefined>()
  private history = $state.raw<{
    rides: RecoRide[]
    load: DailyLoad[]
    date: string
    weekday: number
  }>()

  result = $derived.by((): Recommendation | undefined => {
    const h = this.history
    if (!h) return undefined
    const candidates: Candidate[] = library.all.map((w) => {
      const m = library.meta(w)
      return { id: w.id, type: m.type, difficulty: m.difficulty, durationS: m.durationS }
    })
    return recommend({
      today: h.date,
      weekday: h.weekday,
      profile: {
        goal: profile.goal,
        weeklyHours: profile.weeklyHours,
        rideDays: profile.rideDays,
      },
      minutes: this.minutes,
      load: h.load,
      rides: h.rides.map(toRecord),
      candidates,
    })
  })

  async refresh(): Promise<void> {
    try {
      await library.load()
      const [rides, load] = await Promise.all([
        window.cyclotron.analytics.recoRides(HISTORY_DAYS),
        window.cyclotron.analytics.load(),
      ])
      this.history = { rides, load, ...localToday() }
      this.error = undefined
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
    }
  }
}

/** Adds what the engine needs from the workout the ride followed (type, difficulty, plan). */
function toRecord(r: RecoRide): RideRecord {
  const workout = r.workoutId ? library.find(r.workoutId) : undefined
  const meta = workout && library.meta(workout)
  return {
    date: r.date,
    workoutId: r.workoutId,
    type: meta?.type,
    difficulty: meta?.difficulty,
    tss: r.tss,
    intensity: r.intensity,
    durationS: r.timerS,
    zoneS: r.zoneS,
    feedback: r.feedback,
    targetHit: r.targetHit,
    completed: meta && meta.durationS > 0 ? r.timerS / meta.durationS : undefined,
  }
}

export const today = new Today()
