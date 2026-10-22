<script lang="ts">
  import { masonry } from '../lib/masonry'
  import TodayCard from '../components/TodayCard.svelte'
  import WeekPlanCard from '../components/WeekPlanCard.svelte'
  import { devices } from '../devices/devices.svelte'
  import { go } from '../nav.svelte'
  import { formatDateTime } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { recovery } from '../ride/recovery.svelte'

  const h = $derived(t().app.home)
</script>

<h1>{h.title}</h1>

<div class="cards" use:masonry>
  {#if recovery.found}
    <section class="card">
      <h2>{h.unfinishedTitle}</h2>
      <p>
        {h.unfinished(
          recovery.found.ride.workoutName,
          formatDateTime(recovery.found.ride.startedAt),
          recovery.found.samples.length,
        )}
      </p>
      <button
        class="primary"
        onclick={async () => {
          if (await recovery.continue()) go('ride')
        }}
        disabled={recovery.busy}>{h.continueRide}</button
      >
      <button onclick={() => recovery.save()} disabled={recovery.busy}>{h.saveRide}</button>
      <button onclick={() => recovery.discard()} disabled={recovery.busy}>{h.discard}</button>
    </section>
  {/if}
  {#if recovery.message}<p class="muted">{recovery.message}</p>{/if}

  <TodayCard />

  <section class="card">
    <h2>{h.quickStart}</h2>
    {#if devices.trainer}
      <button onclick={() => go('ride')}>{h.freeRide}</button>
      <button onclick={() => go('workouts')}>{h.workouts}</button>
      <button onclick={() => go('workouts')}>{h.ftpTest}</button>
    {:else}
      <p class="muted">{h.connectFirst}</p>
      <button onclick={() => go('settings')}>{h.devices}</button>
    {/if}
  </section>

  <WeekPlanCard />
</div>
