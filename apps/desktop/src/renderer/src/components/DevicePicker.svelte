<script lang="ts">
  import type { BluetoothDeviceInfo } from '../../../shared/api'

  let { open }: { open: boolean } = $props()

  let devices = $state<BluetoothDeviceInfo[]>([])
  let showUnnamed = $state(false)

  $effect(() => window.cyclotron.bluetooth.onDeviceList((list) => (devices = list)))
  $effect(() => {
    if (!open) devices = []
  })

  const visible = $derived(
    devices
      .filter((d) => showUnnamed || d.name)
      .toSorted((a, b) => (a.name || '~').localeCompare(b.name || '~')),
  )
</script>

{#if open}
  <div class="backdrop">
    <div class="dialog" role="dialog" aria-label="Choose a Bluetooth device">
      <h2>Choose a device</h2>
      <p class="muted">Scanning… wake the trainer by pedalling or spinning the flywheel.</p>
      <ul>
        {#each visible as d (d.id)}
          <li>
            <button onclick={() => window.cyclotron.bluetooth.selectDevice(d.id)}>
              {d.name || 'Unknown device'} <span class="muted">{d.id}</span>
            </button>
          </li>
        {:else}
          <li class="muted">No devices yet</li>
        {/each}
      </ul>
      <label>
        <input type="checkbox" bind:checked={showUnnamed} />
        Show unnamed devices ({devices.filter((d) => !d.name).length})
      </label>
      <div class="actions">
        <button onclick={() => window.cyclotron.bluetooth.cancelSelection()}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.6);
    display: grid;
    place-items: center;
  }
  .dialog {
    background: #1b2027;
    padding: 1.5rem;
    border-radius: 8px;
    width: min(32rem, 90vw);
  }
  ul {
    list-style: none;
    padding: 0;
    max-height: 50vh;
    overflow: auto;
  }
  li button {
    width: 100%;
    text-align: left;
    margin-bottom: 0.25rem;
  }
  .actions {
    margin-top: 1rem;
    text-align: right;
  }
  .muted {
    color: var(--muted);
    font-size: 0.85em;
  }
</style>
