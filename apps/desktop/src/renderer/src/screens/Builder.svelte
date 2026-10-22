<script lang="ts">
  // E3-8: workout builder. Edits builder.draft in place; the profile and stats follow live.
  import {
    buildTimeline,
    MAX_PCT,
    MAX_REPEAT,
    newStep,
    validateWorkout,
    workoutStats,
    workoutToZwo,
    type StepTemplate,
    type Workout,
    type WorkoutProblem,
  } from '@cyclotron/core'
  import StepRow from '../components/StepRow.svelte'
  import WorkoutProfile from '../components/WorkoutProfile.svelte'
  import { formatNumber } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
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
  const ADD: StepTemplate[] = [
    'warmup',
    'steady',
    'intervals',
    'ramp',
    'freeride',
    'maxeffort',
    'cooldown',
  ]

  const typeLabel = (type: string): string =>
    (t().common.workoutTypes as Record<string, string>)[type] ??
    t().library.builder.extraTypes[type] ??
    type

  function problemText(p: WorkoutProblem): string {
    const b = t().library.builder
    const text =
      p.code === 'repeatCount'
        ? b.problems.repeatCount(MAX_REPEAT)
        : p.code === 'power'
          ? b.problems.power(MAX_PCT * 100)
          : b.problems[p.code]
    return p.path ? `${b.stepAt(p.path)}: ${text}` : text
  }

  function snapshot(): Workout {
    const w = $state.snapshot(builder.draft) as Workout
    return { ...w, name: w.name.trim(), source: 'custom' }
  }

  async function save(): Promise<Workout | undefined> {
    if (problems.length > 0) return undefined
    const w = snapshot()
    await library.upsert(w)
    builder.markSaved(w.id)
    message = t().library.builder.savedMessage(w.name)
    return w
  }

  async function saveAndRide(): Promise<void> {
    const w = await save()
    if (!w) return
    if (ride.load(w)) go('ride')
    else message = t().library.builder.savedBusy
  }

  async function exportZwo(): Promise<void> {
    if (problems.length > 0) return
    const w = snapshot()
    const path = await window.cyclotron.workouts.exportZwo(`${w.name}.zwo`, workoutToZwo(w))
    if (path) message = t().library.builder.exported(path)
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
  <h1>{builder.editingId ? t().library.builder.editTitle : t().library.builder.newTitle}</h1>
  <div class="buttons">
    {#if confirmLeave}
      <span class="warn">{t().library.builder.leaveQuestion}</span>
      <button onclick={leave}>{t().library.builder.leave}</button>
      <button onclick={() => (confirmLeave = false)}>{t().library.builder.stay}</button>
    {:else}
      <button onclick={leave}>{t().library.builder.back}</button>
    {/if}
    <button onclick={exportZwo} disabled={problems.length > 0}
      >{t().library.builder.exportZwo}</button
    >
    <button onclick={saveAndRide} disabled={problems.length > 0}
      >{t().library.builder.saveAndRide}</button
    >
    <button class="primary" onclick={save} disabled={problems.length > 0 || !builder.dirty}>
      {builder.dirty ? t().common.actions.save : t().library.builder.saved}
    </button>
  </div>
</div>

{#if message}<p class="muted">{message}</p>{/if}

<section class="card wide">
  <div class="meta">
    <label>
      {t().library.builder.name}
      <input class="name" bind:value={builder.draft.name} maxlength="80" />
    </label>
    <label>
      {t().library.builder.type}
      <select bind:value={builder.draft.type}>
        {#each TYPES as type (type)}<option value={type}>{typeLabel(type)}</option>{/each}
      </select>
    </label>
    {#if stats}
      <p class="stats">
        {formatDuration(stats.durationS)} · TSS {Math.round(stats.tss)} · IF {formatNumber(
          stats.intensity,
          2,
        )} · {t().library.builder.atFtp(profile.ftpW)}
      </p>
    {/if}
  </div>
  <label class="desc">
    {t().library.builder.description}
    <textarea
      rows="2"
      maxlength="2000"
      placeholder={t().library.builder.descriptionPlaceholder}
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
  <h2>{t().library.builder.steps}</h2>
  {#if draft.steps.length === 0}
    <p class="muted">{t().library.builder.noSteps}</p>
  {/if}
  <ol class="steps">
    {#each draft.steps, i (i)}
      <StepRow steps={builder.draft.steps} index={i} ftpW={profile.ftpW} />
    {/each}
  </ol>
  <div class="add">
    <span class="muted">{t().library.builder.add}</span>
    {#each ADD as template (template)}
      <button onclick={() => builder.draft.steps.push(newStep(template))}
        >+ {t().library.builder.templates[template]}</button
      >
    {/each}
  </div>
  {#if problems.length > 0}
    <ul class="problems">
      {#each problems as p, i (i)}<li>{problemText(p)}</li>{/each}
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
