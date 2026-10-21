<script lang="ts">
  import { buildTimeline, FTP_TESTS, workoutStats, type Workout } from '@cyclotron/core'
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

  const toItem = (w: Workout) => ({
    workout: w,
    timeline: buildTimeline(w.steps),
    stats: workoutStats(w),
  })
  const tests = FTP_TESTS.map(toItem)
  const items = $derived(library.all.map(toItem))

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

{#snippet card({ workout, timeline, stats }: ReturnType<typeof toItem>)}
  <article class="card">
    <div class="title">
      <h2>{workout.name}</h2>
      {#if workout.type}<span class="tag">{workout.type}</span>{/if}
    </div>
    <WorkoutProfile {timeline} ftpW={profile.ftpW} height={60} />
    {#if workout.ftpTest === 'ramp'}
      <p class="stats">About 20–30 min · ends when you can't hold the target</p>
    {:else}
      <p class="stats">
        {formatDuration(stats.durationS)} · TSS {Math.round(stats.tss)} · IF {stats.intensity.toFixed(
          2,
        )}
      </p>
    {/if}
    {#if workout.description}<p class="muted desc">{workout.description}</p>{/if}
    <div class="actions">
      <button onclick={() => choose(workout)}>Ride</button>
      {#if workout.source !== 'builtin'}
        <button class="quiet" onclick={() => library.remove(workout.id)}>Delete</button>
      {/if}
    </div>
  </article>
{/snippet}

<h2 class="section">FTP tests</h2>
<div class="list">
  {#each tests as item (item.workout.id)}{@render card(item)}{/each}
</div>

<h2 class="section">Workouts</h2>
<div class="list">
  {#each items as item (item.workout.id)}{@render card(item)}{/each}
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
