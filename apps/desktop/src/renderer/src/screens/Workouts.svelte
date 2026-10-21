<script lang="ts">
  import { buildTimeline, workoutStats, type Workout } from '@cyclotron/core'
  import WorkoutProfile from '../components/WorkoutProfile.svelte'
  import { formatDuration } from '../lib/format'
  import { go } from '../nav.svelte'
  import { profile } from '../profile.svelte'
  import { ride } from '../ride/session.svelte'
  import { library } from '../workouts/library.svelte'

  let error = $state<string | undefined>()

  $effect(() => {
    library.load().catch((e: unknown) => (error = `Couldn't load your workouts: ${String(e)}`))
  })

  const items = $derived(
    library.all.map((w) => ({
      workout: w,
      timeline: buildTimeline(w.steps),
      stats: workoutStats(w),
    })),
  )

  function choose(w: Workout): void {
    if (ride.load(w)) go('ride')
    else error = 'Finish or end the current workout first.'
  }

  async function importZwo(): Promise<void> {
    error = undefined
    try {
      await library.importZwo()
    } catch (e) {
      error = `Import failed: ${e instanceof Error ? e.message : String(e)}`
    }
  }
</script>

<div class="head">
  <h1>Workouts</h1>
  <button onclick={importZwo}>Import .zwo…</button>
</div>
<p class="muted">
  Targets use your FTP of {profile.ftpW} W (change it in Settings).
</p>

{#if error}<p class="error">{error}</p>{/if}
{#each library.messages as m (m)}<p class="muted">{m}</p>{/each}

<div class="list">
  {#each items as { workout, timeline, stats } (workout.id)}
    <article class="card">
      <div class="title">
        <h2>{workout.name}</h2>
        {#if workout.type}<span class="tag">{workout.type}</span>{/if}
      </div>
      <WorkoutProfile {timeline} height={60} />
      <p class="stats">
        {formatDuration(stats.durationS)} · TSS {Math.round(stats.tss)} · IF {stats.intensity.toFixed(
          2,
        )}
      </p>
      {#if workout.description}<p class="muted desc">{workout.description}</p>{/if}
      <div class="actions">
        <button onclick={() => choose(workout)}>Ride</button>
        {#if workout.source !== 'builtin'}
          <button class="quiet" onclick={() => library.remove(workout.id)}>Delete</button>
        {/if}
      </div>
    </article>
  {/each}
</div>

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 60rem;
  }
  .head h1 {
    margin: 0;
  }
  .list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
    gap: 0.75rem;
    max-width: 60rem;
  }
  .list .card {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .title {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }
  .title h2 {
    margin: 0;
  }
  .tag {
    font-size: 0.75rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .stats,
  .desc {
    margin: 0;
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
  .quiet {
    margin-left: auto;
  }
  .error {
    color: var(--error);
  }
</style>
