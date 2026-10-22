import {
  planDay,
  recommend,
  weekPlan,
  type RecoProfile,
  type WeekPlan,
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
  /** Time the rider picked on the Today card; until then, the plan's time for today. */
  chosenMinutes = $state<number | undefined>()
  error = $state<string | undefined>()
  private history = $state.raw<{
    rides: RecoRide[]
    load: DailyLoad[]
    date: string
    weekday: number
  }>()

  private records = $derived(this.history?.rides.map(toRecord) ?? [])

  /** This week's plan (E11-9). */
  plan = $derived.by((): WeekPlan | undefined => {
    const h = this.history
    if (!h) return undefined
    const load = h.load.find((d) => d.date === h.date) ?? h.load.at(-1)
    return weekPlan({
      today: h.date,
      weekday: h.weekday,
      profile: this.profile,
      ctl: load?.ctl ?? 0,
      rides: this.records,
    })
  })

  /** Today in the plan. */
  planToday = $derived(
    this.plan && this.history ? planDay(this.plan, this.history.date) : undefined,
  )

  /** Time for today's ride. */
  get minutes(): number {
    const planned = this.planToday?.minutes
    return this.chosenMinutes ?? (planned || profile.minutesPerRide)
  }

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
      profile: this.profile,
      minutes: this.minutes,
      load: h.load,
      rides: this.records,
      candidates,
      planDay: this.planToday,
    })
  })

  private get profile(): RecoProfile {
    return { goal: profile.goal, weeklyHours: profile.weeklyHours, rideDays: profile.rideDays }
  }

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
