<script lang="ts">
  import { devices } from '../devices/devices.svelte'
  import { go } from '../nav.svelte'
</script>

<button class="status" onclick={() => go('settings')} title="Devices">
  <span
    class="dot"
    class:on={devices.trainer}
    class:warn={devices.trainer && devices.trainerStatus === 'reconnecting'}
  ></span>
  {devices.connecting === 'trainer' ? 'Connecting…' : (devices.trainer?.name ?? 'No trainer')}
  {#if devices.heartRate}
    <span class="dot on" class:warn={devices.heartRateStatus === 'reconnecting'}></span>
    {devices.bpm ?? '–'} bpm
  {/if}
</button>

<style>
  .status {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    background: none;
    border: none;
    color: var(--muted);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    text-align: left;
  }
  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: #5a626d;
  }
  .dot.on {
    background: var(--ok);
  }
  .dot.warn {
    background: var(--warn);
  }
</style>
