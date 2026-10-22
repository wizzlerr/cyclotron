import { newStep, type Workout } from '@cyclotron/core'
import { workoutDescription, workoutName } from '../i18n/content'
import { t } from '../i18n/t'

/** The workout being built or edited (E3-8). Deep state: the step editor mutates it in place. */
class Builder {
  draft = $state<Workout>(blank())
  /** Set when editing a saved workout of the user's; saving replaces it. */
  editingId = $state<string | undefined>()
  /** JSON of the last saved/opened version, to tell whether there are unsaved changes. */
  private saved = $state(JSON.stringify(blank()))

  get dirty(): boolean {
    return JSON.stringify(this.draft) !== this.saved
  }

  /** A new workout. */
  create(): void {
    this.set(blank(), undefined)
  }

  /** Edit one of the user's own workouts. */
  edit(w: Workout): void {
    this.set(clone(w), w.id)
  }

  /** Start from a copy of any workout (built-ins can't be edited in place). */
  duplicate(w: Workout): void {
    const copy = clone(w)
    // A copy of an FTP test is just a workout: no automatic result or ramp-failure detection.
    delete copy.ftpTest
    const name = t().library.builder.copyName(workoutName(w))
    const description = copy.source === 'builtin' ? workoutDescription(w) : copy.description
    this.set({ ...copy, id: newId(), name, description, source: 'custom' }, undefined)
    // A copy isn't saved yet.
    this.saved = ''
  }

  markSaved(id: string): void {
    this.editingId = id
    this.saved = JSON.stringify(this.draft)
  }

  private set(w: Workout, editingId: string | undefined): void {
    this.draft = w
    this.editingId = editingId
    this.saved = JSON.stringify(w)
  }
}

function clone(w: Workout): Workout {
  return structuredClone($state.snapshot(w)) as Workout
}

function blank(): Workout {
  return {
    id: newId(),
    name: t().library.builder.defaultName,
    type: 'endurance',
    source: 'custom',
    steps: [newStep('warmup'), newStep('steady'), newStep('cooldown')],
  }
}

function newId(): string {
  return `custom.${crypto.randomUUID()}`
}

export const builder = new Builder()
