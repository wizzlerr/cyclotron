<script lang="ts">
  // Ride buttons in the side bar: big, coloured and always in the same place, so they're easy to
  // hit from the bike (start green, skip yellow, end red).
  import { devices } from '../devices/devices.svelte'
  import { t } from '../i18n/t'
  import { formatPct } from '../lib/format'
  import { controls, ERG_STEP_W, RESISTANCE_STEP } from '../ride/controls.svelte'
  import { ride } from '../ride/session.svelte'
  import { worldPrefs } from '../world/prefs.svelte'
  import PadHint from './PadHint.svelte'

  const s = $derived(ride.state)
  const A = $derived(t().common.actions)
  const R = $derived(t().ride)
</script>

{#if s}
  <div class="ride-controls" role="group" aria-label={R.controlsLabel}>
    {#if s.status === 'ready'}
      <button class="big go" onclick={() => ride.start()} disabled={!devices.trainer}
        >{A.start}<PadHint action="playPause" /></button
      >
      <button onclick={() => ride.close()}>{A.close}</button>
    {:else}
      {#if s.status === 'running'}
        <button class="big" onclick={() => controls.playPause()}
          >{A.pause}<PadHint action="playPause" /></button
        >
      {:else}
        <button class="big go" onclick={() => controls.playPause()}
          >{A.resume}<PadHint action="playPause" /></button
        >
      {/if}
      {#if !ride.isFreeRide}
        <button class="big skip" onclick={() => controls.skip()}
          >{R.skipStep}<PadHint action="skip" /></button
        >
      {/if}
      {#if controls.confirmEnd}
        <p class="confirm">{R.confirmEnd}</p>
        <button class="big stop" onclick={() => controls.end()}
          >{A.end}<PadHint action="end" /></button
        >
        <button onclick={() => (controls.confirmEnd = false)}>{A.cancel}</button>
      {:else}
        <button class="big stop" onclick={() => controls.end()}
          >{R.endEllipsis}<PadHint action="end" /></button
        >
      {/if}

      {#if !ride.isFreeRide}
        <span class="caption">{R.intensity}</span>
        <div class="trio">
          <button onclick={() => ride.adjustIntensity(-0.01)}>−1</button>
          <button class="value" onclick={() => ride.resetIntensity()} title={R.resetIntensity}
            >{formatPct(s.intensity)}</button
          >
          <button onclick={() => ride.adjustIntensity(0.01)}>+1</button>
          <button onclick={() => ride.adjustIntensity(-0.05)}>−5</button>
          <span></span>
          <button onclick={() => ride.adjustIntensity(0.05)}>+5</button>
        </div>
      {/if}

      {#if controls.inFreeStep}
        {#if controls.manualErgOn}
          <div class="trio">
            <button onclick={() => controls.setErg(controls.ergWatts - ERG_STEP_W)}
              >−{ERG_STEP_W}<PadHint action="minus" /></button
            >
            <span class="value">{controls.ergWatts} W</span>
            <button onclick={() => controls.setErg(controls.ergWatts + ERG_STEP_W)}
              >+{ERG_STEP_W}<PadHint action="plus" /></button
            >
          </div>
          <button onclick={() => controls.ergOff()}>{R.ergOff}<PadHint action="erg" /></button>
        {:else if controls.manualResistanceOn}
          <div class="trio">
            <button onclick={() => controls.setResistance(controls.resistancePct - RESISTANCE_STEP)}
              >−{RESISTANCE_STEP}<PadHint action="minus" /></button
            >
            <span class="value">{controls.resistancePct} %</span>
            <button onclick={() => controls.setResistance(controls.resistancePct + RESISTANCE_STEP)}
              >+{RESISTANCE_STEP}<PadHint action="plus" /></button
            >
          </div>
          <button onclick={() => controls.ergOff()}>{R.resistanceOff}</button>
        {:else}
          <button onclick={() => controls.setErg(controls.ergWatts)}
            >{R.ergMode}<PadHint action="erg" /></button
          >
          {#if controls.canResistance}
            <button onclick={() => controls.setResistance(controls.resistancePct)}
              >{R.resistanceMode}</button
            >
          {/if}
        {/if}
      {/if}
    {/if}

    <div class="toggles">
      <button
        class:on={worldPrefs.enabled}
        aria-pressed={worldPrefs.enabled}
        title={worldPrefs.enabled ? t().world.toggleOn : t().world.toggleOff}
        onclick={() => worldPrefs.setEnabled(!worldPrefs.enabled)}
        >{t().world.toggle}<PadHint action="world" /></button
      >
      <button
        class:on={ride.muted}
        aria-pressed={ride.muted}
        onclick={() => (ride.muted = !ride.muted)}>{R.mute}<PadHint action="mute" /></button
      >
    </div>
  </div>
{/if}

<style>
  .ride-controls {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--grid);
  }
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    font: inherit;
  }
  .big {
    padding: 0.85rem 0.5rem;
    font-size: 1.1rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .go {
    background: var(--ok);
    border-color: var(--ok);
    color: #111418;
  }
  .skip {
    background: var(--warn);
    border-color: var(--warn);
    color: #111418;
  }
  .stop {
    background: var(--error);
    border-color: var(--error);
    color: #111418;
  }
  .go:hover:not(:disabled),
  .skip:hover,
  .stop:hover {
    filter: brightness(1.1);
  }
  .confirm {
    margin: 0.25rem 0 0;
    color: var(--warn);
    font-size: 0.9rem;
  }
  .caption {
    margin-top: 0.4rem;
    color: var(--muted);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .trio {
    display: grid;
    grid-template-columns: 1fr 1.4fr 1fr;
    gap: 0.3rem;
    align-items: center;
  }
  .trio button {
    padding: 0.45rem 0.2rem;
  }
  .value {
    font-weight: 700;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .toggles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.3rem;
    margin-top: 0.4rem;
  }
  .toggles button {
    padding: 0.4rem 0.2rem;
    font-size: 0.85rem;
  }
  .toggles .on {
    outline: 2px solid var(--series-1);
  }
</style>
