<script lang="ts">
  import { devices } from '../devices/devices.svelte'
  import { go } from '../nav.svelte'
  import { recovery } from '../ride/recovery.svelte'

  const date = (ms: number): string =>
    new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
</script>

<h1>Home</h1>

{#if recovery.found}
  <section class="card">
    <h2>Unfinished ride</h2>
    <p>
      {recovery.found.ride.workoutName} from {date(recovery.found.ride.startedAt)} wasn't finished ({recovery
        .found.samples.length} s recorded). Save what was recorded?
    </p>
    <button onclick={() => recovery.save()} disabled={recovery.busy}>Save ride</button>
    <button onclick={() => recovery.discard()} disabled={recovery.busy}>Discard</button>
  </section>
{/if}
{#if recovery.message}<p class="muted">{recovery.message}</p>{/if}

<section class="card">
  <h2>Today</h2>
  <p class="muted">Recommended workouts arrive with E11.</p>
</section>

<section class="card">
  <h2>Quick start</h2>
  {#if devices.trainer}
    <button onclick={() => go('ride')}>Free ride</button>
    <button onclick={() => go('workouts')}>Workouts…</button>
    <button onclick={() => go('workouts')}>FTP test…</button>
  {:else}
    <p class="muted">Connect a trainer first.</p>
    <button onclick={() => go('settings')}>Devices…</button>
  {/if}
</section>
