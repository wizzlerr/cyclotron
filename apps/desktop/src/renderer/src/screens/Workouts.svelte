<script lang="ts">
  // E10: workout library browser.
  import {
    buildTimeline,
    FTP_TESTS,
    WORKOUT_TYPES,
    workoutStats,
    type Route,
    type Workout,
  } from '@cyclotron/core'
  import RoutePicker from '../components/RoutePicker.svelte'
  import WorkoutProfile from '../components/WorkoutProfile.svelte'
  import { workoutDescription, workoutName } from '../i18n/content'
  import { errorText } from '../i18n/errors'
  import { formatDate, formatNumber } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { formatDuration } from '../lib/format'
  import { go } from '../nav.svelte'
  import { profile } from '../profile.svelte'
  import { ride } from '../ride/session.svelte'
  import { builder } from '../workouts/builder.svelte'
  import { library } from '../workouts/library.svelte'

  let error = $state<string | undefined>()

  $effect(() => {
    library.load().catch((e: unknown) => (error = t().library.workouts.loadFailed(String(e))))
    library.refreshDone().catch(() => {})
  })

  // Ranges are [min, max); labels are t().library.workouts.durations / difficulties by index.
  const DURATIONS = [
    { min: 0, max: Infinity },
    { min: 0, max: 46 * 60 },
    { min: 46 * 60, max: 61 * 60 },
    { min: 61 * 60, max: 91 * 60 },
    { min: 91 * 60, max: Infinity },
  ]
  const DIFFICULTIES = [
    { min: 0, max: Infinity },
    { min: 0, max: 4 },
    { min: 4, max: 7 },
    { min: 7, max: Infinity },
  ]
  const SORTS = ['type', 'duration', 'difficulty', 'name'] as const

  type Item = (typeof items)[number]
  const SORT_BY: Record<(typeof SORTS)[number], (a: Item, b: Item) => number> = {
    type: (a, b) =>
      WORKOUT_TYPES.indexOf(a.meta.type) - WORKOUT_TYPES.indexOf(b.meta.type) ||
      a.meta.difficulty - b.meta.difficulty,
    duration: (a, b) => a.meta.durationS - b.meta.durationS,
    difficulty: (a, b) => a.meta.difficulty - b.meta.difficulty,
    name: (a, b) => workoutName(a.workout).localeCompare(workoutName(b.workout)),
  }

  const f = library.filters
  const inRange = (v: number, r: { min: number; max: number }): boolean => v >= r.min && v < r.max

  const items = $derived(
    library.all.map((workout) => ({
      workout,
      timeline: buildTimeline(workout.steps),
      meta: library.meta(workout),
    })),
  )
  const shown = $derived.by(() => {
    const q = f.search.trim().toLowerCase()
    const list = items.filter(
      ({ workout: w, meta: m }) =>
        (workoutName(w).toLowerCase().includes(q) ||
          (workoutDescription(w) ?? '').toLowerCase().includes(q)) &&
        (!f.type || m.type === f.type) &&
        inRange(m.durationS, DURATIONS[f.duration]!) &&
        inRange(m.difficulty, DIFFICULTIES[f.difficulty]!) &&
        (!f.favouritesOnly || library.isFavourite(w.id)),
    )
    const by = SORT_BY[f.sort]
    // Favourites first, then the chosen order.
    return list.sort(
      (a, b) =>
        Number(library.isFavourite(b.workout.id)) - Number(library.isFavourite(a.workout.id)) ||
        by(a, b),
    )
  })

  const tests = FTP_TESTS.map((workout) => ({
    workout,
    timeline: buildTimeline(workout.steps),
    stats: workoutStats(workout),
  }))

  const doneLabel = (id: string): string | undefined => {
    const d = library.done.get(id)
    if (!d) return undefined
    return t().library.workouts.done(d.count, formatDate(d.lastAt))
  }

  /** Workout waiting for a route choice. */
  let picking = $state<Workout | undefined>()

  function choose(w: Workout): void {
    // FTP tests run without a route; their free-effort steps shouldn't follow a road's grade.
    if (w.ftpTest) start(w, undefined)
    else picking = w
  }

  function start(w: Workout, route: Route | undefined): void {
    picking = undefined
    if (route ? ride.loadRoute(route, w) : ride.load(w)) go('ride')
    else error = t().library.workouts.rideBusy
  }

  async function importZwo(): Promise<void> {
    error = undefined
    try {
      await library.importZwo()
    } catch (e) {
      error = t().library.workouts.importFailed(errorText(e))
    }
  }
</script>

<div class="head">
  <h1>{t().library.workouts.title}</h1>
  <div class="head-buttons">
    <button onclick={importZwo}>{t().library.workouts.importZwo}</button>
    <button class="primary" onclick={() => (builder.create(), go('builder'))}
      >{t().library.workouts.newWorkout}</button
    >
  </div>
</div>
<p class="muted">{t().library.workouts.intro(profile.ftpW)}</p>

{#if error}<p class="error">{error}</p>{/if}
{#each library.messages as m (m)}<p class="muted">{m}</p>{/each}

{#if picking}
  {@const w = picking}
  <RoutePicker
    title={workoutName(w)}
    onpick={(route) => start(w, route)}
    oncancel={() => (picking = undefined)}
  />
{/if}

{#snippet actions(workout: Workout)}
  <div class="actions">
    <button onclick={() => choose(workout)}>{t().common.actions.ride}</button>
    {#if workout.source !== 'builtin'}
      <button onclick={() => (builder.edit(workout), go('builder'))}
        >{t().common.actions.edit}</button
      >
    {/if}
    <button onclick={() => (builder.duplicate(workout), go('builder'))}
      >{t().common.actions.duplicate}</button
    >
    {#if workout.source !== 'builtin'}
      <button class="quiet" onclick={() => library.remove(workout.id)}
        >{t().common.actions.delete}</button
      >
    {/if}
  </div>
{/snippet}

<h2 class="section">{t().library.workouts.ftpTests}</h2>
<div class="list">
  {#each tests as { workout, timeline, stats } (workout.id)}
    <article class="card">
      <div class="title"><h2>{workoutName(workout)}</h2></div>
      <WorkoutProfile {timeline} ftpW={profile.ftpW} height={60} />
      {#if workout.ftpTest === 'ramp'}
        <p class="stats">{t().library.workouts.rampTestLength}</p>
      {:else}
        <p class="stats">{formatDuration(stats.durationS)} · TSS {Math.round(stats.tss)}</p>
      {/if}
      {#if doneLabel(workout.id)}<p class="done">{doneLabel(workout.id)}</p>{/if}
      {#if workoutDescription(workout)}<p class="muted desc">{workoutDescription(workout)}</p>{/if}
      {@render actions(workout)}
    </article>
  {/each}
</div>

<h2 class="section">{t().library.workouts.title}</h2>
<div class="filters">
  <input
    type="search"
    placeholder={t().common.actions.search}
    bind:value={f.search}
    aria-label={t().library.workouts.searchLabel}
  />
  <select bind:value={f.type} aria-label={t().library.workouts.type}>
    <option value="">{t().library.workouts.allTypes}</option>
    {#each WORKOUT_TYPES as type (type)}<option value={type}>{t().common.workoutTypes[type]}</option
      >{/each}
  </select>
  <select bind:value={f.duration} aria-label={t().library.workouts.length}>
    {#each t().library.workouts.durations as label, i (i)}<option value={i}>{label}</option>{/each}
  </select>
  <select bind:value={f.difficulty} aria-label={t().library.workouts.levelLabel}>
    {#each t().library.workouts.difficulties as label, i (i)}<option value={i}>{label}</option
      >{/each}
  </select>
  <select bind:value={f.sort} aria-label={t().library.workouts.sort}>
    {#each SORTS as s (s)}<option value={s}>{t().library.workouts.sorts[s]}</option>{/each}
  </select>
  <label><input type="checkbox" bind:checked={f.favouritesOnly} /> {t().common.favourites}</label>
  <span class="muted count">{t().common.countOf(shown.length, items.length)}</span>
</div>

{#if shown.length === 0}
  <p class="muted">{t().library.workouts.noMatch}</p>
{/if}

<div class="list">
  {#each shown as { workout, timeline, meta } (workout.id)}
    {@const fav = library.isFavourite(workout.id)}
    {@const done = doneLabel(workout.id)}
    <article class="card">
      <div class="title">
        <h2>{workoutName(workout)}</h2>
        <button
          class="star"
          class:on={fav}
          onclick={() => library.toggleFavourite(workout.id)}
          title={fav ? t().common.actions.removeFavourite : t().common.actions.addFavourite}
          aria-pressed={fav}>{fav ? '★' : '☆'}</button
        >
      </div>
      <p class="tag">
        {t().common.workoutTypes[meta.type]} · {t().common.level(formatNumber(meta.difficulty, 1))}
      </p>
      <WorkoutProfile {timeline} ftpW={profile.ftpW} height={60} />
      <p class="stats">
        {formatDuration(meta.durationS)} · TSS {Math.round(meta.tss)} · IF {formatNumber(
          meta.intensity,
          2,
        )}
      </p>
      {#if done}<p class="done">✓ {done}</p>{/if}
      {#if workoutDescription(workout)}<p class="muted desc">{workoutDescription(workout)}</p>{/if}
      {@render actions(workout)}
    </article>
  {/each}
</div>

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .head h1 {
    margin: 0;
  }
  .head-buttons {
    display: flex;
    gap: 0.5rem;
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .filters input[type='search'] {
    width: 12rem;
  }
  .count {
    margin-left: auto;
  }
  .list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
    gap: 0.75rem;
  }
  .list .card {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .title h2 {
    margin: 0;
  }
  .star {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: var(--muted);
    padding: 0 0.25rem;
  }
  .star.on {
    color: var(--warn);
  }
  .tag {
    margin: -0.25rem 0 0;
    font-size: 0.75rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .stats,
  .desc,
  .done {
    margin: 0;
  }
  .done {
    font-size: 0.85rem;
    color: var(--ok);
  }
  .desc {
    font-size: 0.9rem;
    white-space: pre-line;
    flex: 1;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
  }
  .section {
    margin: 1.5rem 0 0.75rem;
  }
  .quiet {
    margin-left: auto;
  }
  .error {
    color: var(--error);
  }
</style>
