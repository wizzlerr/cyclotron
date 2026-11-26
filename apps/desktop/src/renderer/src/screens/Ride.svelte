<script lang="ts">
  import PadHint from '../components/PadHint.svelte'
  import { padmap } from '../lib/padmap.svelte'
  import { padnav } from '../lib/padnav.svelte'
  import { controls, ERG_STEP_W, RESISTANCE_STEP } from '../ride/controls.svelte'
  import RideSummary from '../components/RideSummary.svelte'
  import RideTiles from '../components/RideTiles.svelte'
  import { rideLayout } from '../ride/layout.svelte'
  import { devices } from '../devices/devices.svelte'
  import { workoutName } from '../i18n/content'
  import { t } from '../i18n/t'
  import { describeSegment as describe } from '../lib/format'
  import { go } from '../nav.svelte'
  import { ride } from '../ride/session.svelte'

  // The ride screen fits the window, since nobody scrolls from the bike: the page is a column as
  // tall as the window and the rider's grid of tiles and panels (RideTiles `fit`) shares what is
  // left after the heading. Only when its rows would get too small does the page scroll.
  const s = $derived(ride.state)
  const manualErgOn = $derived(controls.manualErgOn)

  // Zwift controller buttons navigation didn't use (lib/padnav.svelte.ts), run as the action
  // they're mapped to (Settings → Controllers).
  $effect(() => padnav.unhandled.on((button) => controls.run(padmap.action(button))))
</script>

{#snippet ergControls()}
  {#if manualErgOn}
    <button onclick={() => controls.setErg(controls.ergWatts - ERG_STEP_W)}
      >−{ERG_STEP_W} W<PadHint action="minus" /></button
    >
    <span class="erg">ERG {controls.ergWatts} W</span>
    <button onclick={() => controls.setErg(controls.ergWatts + ERG_STEP_W)}
      >+{ERG_STEP_W} W<PadHint action="plus" /></button
    >
    <button onclick={() => controls.ergOff()}>{t().ride.ergOff}<PadHint action="erg" /></button>
  {:else if controls.manualResistanceOn}
    <button onclick={() => controls.setResistance(controls.resistancePct - RESISTANCE_STEP)}
      >−{RESISTANCE_STEP} %<PadHint action="minus" /></button
    >
    <span class="erg">{t().ride.resistance(controls.resistancePct)}</span>
    <button onclick={() => controls.setResistance(controls.resistancePct + RESISTANCE_STEP)}
      >+{RESISTANCE_STEP} %<PadHint action="plus" /></button
    >
    <button onclick={() => controls.ergOff()}>{t().ride.resistanceOff}</button>
  {:else}
    <button onclick={() => controls.setErg(controls.ergWatts)}
      >{t().ride.ergMode}<PadHint action="erg" /></button
    >
    {#if controls.canResistance}
      <button onclick={() => controls.setResistance(controls.resistancePct)}
        >{t().ride.resistanceMode}</button
      >
    {/if}
  {/if}
{/snippet}

{#snippet deviceWarnings()}
  {#if !devices.trainer}
    <p class="warn">
      {t().ride.noTrainer}
      <button onclick={() => go('settings', 'devices')}>{t().ride.devices}</button>
    </p>
  {:else if devices.trainerStatus === 'reconnecting'}
    <p class="warn">{t().ride.reconnecting}</p>
  {:else if !devices.trainer.capabilities().erg}
    <p class="muted">{t().ride.readOnlyTrainer}</p>
  {/if}
{/snippet}

{#if ride.workout && ride.player && s}
  <div class="ride-page">
    <div class="head">
      <h1>{workoutName(ride.workout)}</h1>
      {#if !ride.isFreeRide}<span class="muted">{describe(s.segment)}</span>{/if}
      {#if s.status !== 'finished' && !rideLayout.editing}
        <button class="edit-layout" onclick={() => rideLayout.startEditing()}
          >{t().ride.layout.edit}</button
        >
      {/if}
    </div>

    {#if s.status === 'finished'}
      {#if ride.saving}
        <p class="muted">{t().ride.saving}</p>
      {:else if ride.result}
        <RideSummary
          result={ride.result}
          onclose={() => ride.close()}
          ondiscard={() => ride.discard()}
        />
      {:else}
        <p class="muted">{t().ride.nothingRecorded}</p>
        <button onclick={() => ride.close()}>{t().common.actions.close}</button>
      {/if}
    {:else}
      {@render deviceWarnings()}

      <RideTiles fit />
    {/if}

    {#if ride.notice && s.status !== 'finished'}<p class="warn">{ride.notice()}</p>{/if}
    {#if ride.error}<p class="error">{ride.error()}</p>{/if}
    {#if devices.error}<p class="error">{devices.error}</p>{/if}
  </div>
{:else}
  <h1>{t().ride.title}</h1>

  {#if !devices.trainer}
    <p class="muted">{t().ride.noTrainer}</p>
    <button onclick={() => go('settings', 'devices')}>{t().ride.devices}</button>
  {:else}
    {@render deviceWarnings()}
    <RideTiles />

    <section class="controls">
      <button class="primary" onclick={() => ride.startFreeRide()}>{t().ride.startFreeRide}</button>
      <button onclick={() => go('workouts')}>{t().ride.chooseWorkout}</button>
      <span class="sep"></span>
      {@render ergControls()}
      {#if !rideLayout.editing}
        <span class="sep"></span>
        <button onclick={() => rideLayout.startEditing()}>{t().ride.layout.edit}</button>
      {/if}
    </section>
    <p class="muted">{t().ride.notRecordedYet}</p>
    {#if devices.error}<p class="error">{devices.error}</p>{/if}
  {/if}
{/if}

<style>
  .head {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .head h1 {
    margin: 0;
  }
  .edit-layout {
    margin-left: auto;
    font-size: 0.85rem;
    padding: 0.15rem 0.6rem;
  }
  .controls {
    margin-top: 1rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .sep {
    width: 1rem;
  }
  .primary {
    font-weight: 600;
  }
  .warn {
    color: var(--warn);
  }
  .error {
    color: var(--error);
  }
  .erg {
    min-width: 7rem;
    text-align: center;
    font-weight: 600;
  }
  /* A column with even gaps, so its height is the sum of its parts (fit()). Last, so it wins
     over the margins above. */
  .ride-page {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    height: 100%;
  }
  .ride-page > :global(*) {
    margin-top: 0;
    margin-bottom: 0;
  }
</style>
