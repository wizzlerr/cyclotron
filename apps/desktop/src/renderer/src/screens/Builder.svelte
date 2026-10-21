<script lang="ts">
  // E3-8: workout builder. Edits builder.draft in place; the profile and stats follow live.
  import {
    buildTimeline,
    newStep,
    validateWorkout,
    workoutStats,
    workoutToZwo,
    type StepTemplate,
    type Workout,
  } from '@cyclotron/core'
  import StepRow from '../components/StepRow.svelte'
  import WorkoutProfile from '../components/WorkoutProfile.svelte'
  import { formatDuration } from '../lib/format'
  import { go } from '../nav.svelte'
  import { profile } from '../profile.svelte'
  import { ride } from '../ride/session.svelte'
  import { builder } from '../workouts/builder.svelte'
  import { library } from '../workouts/library.svelte'

  const draft = $derived(builder.draft)
  const timeline = $derived(buildTimeline(draft.steps))
  const problems = $derived(validateWorkout(draft))
  const stats = $derived(problems.length === 0 ? workoutStats(draft) : undefined)

  let message = $state<string | undefined>()
  let confirmLeave = $state(false)

  const TYPES = [
    'recovery',
    'endurance',
    'tempo',
    'sweetspot',
    'threshold',
    'vo2max',
    'anaerobic',
    'sprint',
    'other',
  ]
  const ADD: { template: StepTemplate; label: string }[] = [
    { template: 'warmup', label: 'Warm-up' },
    { template: 'steady', label: 'Steady' },
    { template: 'intervals', label: 'Intervals' },
    { template: 'ramp', label: 'Ramp' },
    { template: 'freeride', label: 'Free ride' },
    { template: 'maxeffort', label: 'Max effort' },
    { template: 'cooldown', label: 'Cool-down' },
  ]

  function snapshot(): Workout {
    const w = $state.snapshot(builder.draft) as Workout
    return { ...w, name: w.name.trim(), source: 'custom' }
  }

  async function save(): Promise<Workout | undefined> {
    if (problems.length > 0) return undefined
    const w = snapshot()
    await library.upsert(w)
    builder.markSaved(w.id)
    message = `Saved "${w.name}" to your workouts.`
    return w
  }

  async function saveAndRide(): Promise<void> {
    const w = await save()
    if (!w) return
    if (ride.load(w)) go('ride')
    else message = 'Saved. Finish or end the current ride first to ride it.'
  }

  async function exportZwo(): Promise<void> {
    if (problems.length > 0) return
    const w = snapshot()
    const path = await window.cyclotron.workouts.exportZwo(`${w.name}.zwo`, workoutToZwo(w))
    if (path)
      message = `Exported to ${path}. Zwift, TrainerRoad, MyWhoosh and others can import it.`
  }

  function leave(): void {
    if (builder.dirty && !confirmLeave) {
      confirmLeave = true
      return
    }
    confirmLeave = false
    go('workouts')
  }
</script>

<div class="head">
  <h1>{builder.editingId ? 'Edit workout' : 'New workout'}</h1>
  <div class="buttons">
    {#if confirmLeave}
      <span class="warn">Leave without saving?</span>
      <button onclick={leave}>Leave</button>
      <button onclick={() => (confirmLeave = false)}>Stay</button>
    {:else}
      <button onclick={leave}>← Workouts</button>
    {/if}
    <button onclick={exportZwo} disabled={problems.length > 0}>Export .zwo…</button>
    <button onclick={saveAndRide} disabled={problems.length > 0}>Save and ride</button>
    <button class="primary" onclick={save} disabled={problems.length > 0 || !builder.dirty}>
      {builder.dirty ? 'Save' : 'Saved'}
    </button>
  </div>
</div>

{#if message}<p class="muted">{message}</p>{/if}

<section class="card wide">
  <div class="meta">
    <label>
      Name
      <input class="name" bind:value={builder.draft.name} maxlength="80" />
    </label>
    <label>
      Type
      <select bind:value={builder.draft.type}>
        {#each TYPES as t (t)}<option value={t}>{t}</option>{/each}
      </select>
    </label>
    {#if stats}
      <p class="stats">
        {formatDuration(stats.durationS)} · TSS {Math.round(stats.tss)} · IF {stats.intensity.toFixed(
          2,
        )} · at your FTP of {profile.ftpW} W
      </p>
    {/if}
  </div>
  <label class="desc">
    Description
    <textarea
      rows="2"
      maxlength="2000"
      placeholder="What the workout is for, and how to ride it"
      value={builder.draft.description ?? ''}
      oninput={(e) => (builder.draft.description = e.currentTarget.value || undefined)}></textarea>
  </label>

  {#if timeline.length > 0}
    <div class="profile">
      <WorkoutProfile {timeline} ftpW={profile.ftpW} height={140} axes />
    </div>
  {/if}
</section>

<section class="card wide">
  <h2>Steps</h2>
  {#if draft.steps.length === 0}
    <p class="muted">No steps yet. Add some below.</p>
  {/if}
  <ol class="steps">
    {#each draft.steps, i (i)}
      <StepRow steps={builder.draft.steps} index={i} ftpW={profile.ftpW} />
    {/each}
  </ol>
  <div class="add">
    <span class="muted">Add:</span>
    {#each ADD as a (a.template)}
      <button onclick={() => builder.draft.steps.push(newStep(a.template))}>+ {a.label}</button>
    {/each}
  </div>
  {#if problems.length > 0}
    <ul class="problems">
      {#each problems as p (p)}<li>{p}</li>{/each}
    </ul>
  {/if}
</section>

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .head h1 {
    margin: 0 0 1rem;
  }
  .buttons {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .wide {
    max-width: none;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1.5rem;
  }
  .meta label,
  .desc {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .name {
    width: 20rem;
  }
  .stats {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  .desc {
    display: flex;
    margin-top: 0.75rem;
  }
  .desc textarea {
    flex: 1;
    font: inherit;
  }
  .profile {
    margin-top: 1rem;
  }
  .steps {
    margin: 0 0 0.75rem;
    padding: 0;
    display: grid;
    gap: 0.4rem;
  }
  .add {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
  .problems {
    color: var(--warn);
    margin: 0.75rem 0 0;
  }
  .warn {
    color: var(--warn);
  }
</style>
