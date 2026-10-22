import {
  BUILTIN_WORKOUTS,
  parseZwo,
  workoutMeta,
  type Workout,
  type WorkoutMeta,
  type WorkoutType,
} from '@cyclotron/core'
import type { WorkoutDone } from '../../../shared/api'
import { errorText } from '../i18n/errors'
import { t } from '../i18n/t'
import { loadPref, savePref } from '../lib/prefs'

const FAVOURITES_KEY = 'cyclotron.workoutFavourites'

interface LibraryFile {
  version: 1
  workouts: Workout[]
}

export interface LibraryFilters {
  search: string
  type: WorkoutType | ''
  /** Index into DURATIONS / DIFFICULTIES on the Workouts screen. */
  duration: number
  difficulty: number
  favouritesOnly: boolean
  sort: 'type' | 'duration' | 'difficulty' | 'name'
}

/** Built-in workouts plus the user's imported ones (stored by main in workouts.json). */
class Library {
  imported = $state.raw<Workout[]>([])
  favourites = $state.raw<string[]>(loadPref<string[]>(FAVOURITES_KEY) ?? [])
  /** Finished rides per workout id (E10-4). */
  done = $state.raw<Map<string, WorkoutDone>>(new Map())
  /** Kept here so the Workouts screen remembers them while the app runs. */
  filters = $state<LibraryFilters>({
    search: '',
    type: '',
    duration: 0,
    difficulty: 0,
    favouritesOnly: false,
    sort: 'type',
  })
  private metas = new WeakMap<Workout, WorkoutMeta>()
  /** Messages from the last import, e.g. files that weren't valid workouts. */
  messages = $state.raw<string[]>([])
  private loaded: Promise<void> | undefined

  get all(): Workout[] {
    return [...BUILTIN_WORKOUTS, ...this.imported]
  }

  load(): Promise<void> {
    this.loaded ??= window.cyclotron.workouts.load().then((json) => {
      if (json) this.imported = (JSON.parse(json) as LibraryFile).workouts
    })
    return this.loaded
  }

  async importZwo(): Promise<void> {
    await this.load()
    const files = await window.cyclotron.workouts.pickZwo()
    if (files.length === 0) return
    const added: Workout[] = []
    const messages: string[] = []
    for (const f of files) {
      try {
        added.push(parseZwo(f.text, `zwo.${crypto.randomUUID()}`))
      } catch (e) {
        messages.push(`${f.name}: ${errorText(e)}`)
      }
    }
    if (added.length > 0) {
      messages.unshift(t().library.workouts.imported(added.length))
      await this.save([...this.imported, ...added])
    }
    this.messages = messages
  }

  /** Duration, TSS, type, difficulty… (E10-2), computed once per workout object. */
  meta(workout: Workout): WorkoutMeta {
    let m = this.metas.get(workout)
    if (!m) this.metas.set(workout, (m = workoutMeta(workout)))
    return m
  }

  async refreshDone(): Promise<void> {
    const rows = await window.cyclotron.rides.workoutsDone()
    this.done = new Map(rows.map((r) => [r.workoutId, r]))
  }

  isFavourite(id: string): boolean {
    return this.favourites.includes(id)
  }

  toggleFavourite(id: string): void {
    this.favourites = this.favourites.includes(id)
      ? this.favourites.filter((x) => x !== id)
      : [...this.favourites, id]
    savePref(FAVOURITES_KEY, this.favourites)
  }

  find(id: string): Workout | undefined {
    return this.all.find((w) => w.id === id)
  }

  /** Adds a workout from the builder, or replaces the one with the same id (E3-8). */
  async upsert(workout: Workout): Promise<void> {
    await this.load()
    const i = this.imported.findIndex((w) => w.id === workout.id)
    const next = [...this.imported]
    if (i >= 0) next[i] = workout
    else next.push(workout)
    await this.save(next)
  }

  async remove(id: string): Promise<void> {
    await this.save(this.imported.filter((w) => w.id !== id))
    if (this.isFavourite(id)) this.toggleFavourite(id)
  }

  private async save(workouts: Workout[]): Promise<void> {
    const file: LibraryFile = { version: 1, workouts }
    await window.cyclotron.workouts.save(JSON.stringify(file, null, 2))
    this.imported = workouts
  }
}

export const library = new Library()
