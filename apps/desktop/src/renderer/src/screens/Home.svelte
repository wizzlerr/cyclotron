<script lang="ts">
  import { devices } from '../devices/devices.svelte'
  import { go } from '../nav.svelte'
</script>

<h1>Home</h1>

<section class="card">
  <h2>Today</h2>
  <p class="muted">Recommended workouts arrive with E11.</p>
</section>

<section class="card">
  <h2>Quick start</h2>
  {#if devices.trainer}
    <button onclick={() => go('ride')}>Free ride</button>
    <button onclick={() => go('workouts')}>Workouts…</button>
  {:else}
    <p class="muted">Connect a trainer first.</p>
    <button onclick={() => go('settings')}>Devices…</button>
  {/if}
</section>
