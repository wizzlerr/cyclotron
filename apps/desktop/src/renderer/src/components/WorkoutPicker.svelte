<script lang="ts">
  // Choose a workout for a route ride (E13-8), or none: a free ride following the grade.
  import { buildTimeline, WORKOUT_TYPES, type Workout } from '@cyclotron/core'
  import { workoutName } from '../i18n/content'
  import { formatNumber } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { formatDuration } from '../lib/format'
  import { profile } from '../profile.svelte'
  import { library } from '../workouts/library.svelte'
  import PickerDialog from './PickerDialog.svelte'
  import WorkoutProfile from './WorkoutProfile.svelte'

  let {
    title,
    onpick,
    oncancel,
  }: {
    title: string
    /** `undefined` = no workout. */
    onpick: (workout: Workout | undefined) => void
    oncancel: () => void
  } = $props()

  let search = $state('')
  let type = $state('')
  let searchBox = $state<HTMLInputElement>()

  $effect(() => {
    library.load().catch(() => {})
    searchBox?.focus()
  })

  const shown = $derived.by(() => {
    const q = search.trim().toLowerCase()
    return library.all
      .map((workout) => ({ workout, meta: library.meta(workout) }))
      .filter(
        ({ workout: w, meta: m }) =>
          workoutName(w).toLowerCase().includes(q) && (!type || m.type === type),
      )
      .sort(
        (a, b) =>
          Number(library.isFavourite(b.workout.id)) - Number(library.isFavourite(a.workout.id)) ||
          WORKOUT_TYPES.indexOf(a.meta.type) - WORKOUT_TYPES.indexOf(b.meta.type) ||
          a.meta.difficulty - b.meta.difficulty,
      )
  })
</script>

<PickerDialog
  heading={t().library.pickers.workoutHeading}
  subtitle={t().library.pickers.workoutSubtitle(title)}
  {oncancel}
>
  {#snippet controls()}
    <input
      type="search"
      placeholder={t().library.workouts.searchLabel}
      bind:value={search}
      bind:this={searchBox}
      aria-label={t().library.workouts.searchLabel}
    />
    <select bind:value={type} aria-label={t().library.workouts.type}>
      <option value="">{t().library.workouts.allTypes}</option>
      {#each WORKOUT_TYPES as wt (wt)}<option value={wt}>{t().common.workoutTypes[wt]}</option
        >{/each}
    </select>
  {/snippet}

  {#if !search.trim() && !type}
    <button class="tile none" onclick={() => onpick(undefined)}>
      <span class="name">{t().library.pickers.noWorkout}</span>
      <span class="muted">{t().library.pickers.noWorkoutHint}</span>
    </button>
  {/if}
  {#each shown as { workout, meta } (workout.id)}
    <button class="tile" onclick={() => onpick(workout)}>
      <span class="name">
        {#if library.isFavourite(workout.id)}<span class="star">★</span>{/if}
        {workoutName(workout)}
      </span>
      <span class="stats">
        {t().common.workoutTypes[meta.type]} · {t().common.level(formatNumber(meta.difficulty, 1))} ·
        {formatDuration(meta.durationS)} · TSS {Math.round(meta.tss)}
      </span>
      <WorkoutProfile timeline={buildTimeline(workout.steps)} ftpW={profile.ftpW} height={56} />
    </button>
  {:else}
    <p class="muted">{t().library.pickers.noWorkouts}</p>
  {/each}
</PickerDialog>
