import { BUILTIN_WORKOUTS, parseZwo, type Workout } from '@cyclotron/core'

interface LibraryFile {
  version: 1
  workouts: Workout[]
}

/** Built-in workouts plus the user's imported ones (stored by main in workouts.json). */
class Library {
  imported = $state.raw<Workout[]>([])
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
        messages.push(`${f.name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (added.length > 0) {
      messages.unshift(`Imported ${added.length} workout${added.length === 1 ? '' : 's'}.`)
      await this.save([...this.imported, ...added])
    }
    this.messages = messages
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
  }

  private async save(workouts: Workout[]): Promise<void> {
    const file: LibraryFile = { version: 1, workouts }
    await window.cyclotron.workouts.save(JSON.stringify(file, null, 2))
    this.imported = workouts
  }
}

export const library = new Library()
