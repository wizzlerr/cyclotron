<script lang="ts">
  import type { BluetoothDeviceInfo } from '../../../shared/api'
  import { t } from '../i18n/t'

  let { open }: { open: boolean } = $props()

  let devices = $state<BluetoothDeviceInfo[]>([])
  let showUnnamed = $state(false)

  // Braces matter: a callback returning the $state proxy fails to clone back across the bridge.
  $effect(() =>
    window.cyclotron.bluetooth.onDeviceList((list) => {
      devices = list
    }),
  )
  $effect(() => {
    if (!open) devices = []
  })

  const visible = $derived(
    devices
      .filter((d) => showUnnamed || d.name)
      .toSorted((a, b) => (a.name || '~').localeCompare(b.name || '~')),
  )
</script>

<svelte:window
  onkeydown={(e) => open && e.key === 'Escape' && window.cyclotron.bluetooth.cancelSelection()}
/>

{#if open}
  <div class="backdrop">
    <div class="dialog" role="dialog" aria-label={t().app.picker.label}>
      <h2>{t().app.picker.title}</h2>
      <p class="muted">{t().app.picker.scanning}</p>
      <ul>
        {#each visible as d (d.id)}
          <li>
            <button onclick={() => window.cyclotron.bluetooth.selectDevice(d.id)}>
              {d.name || t().app.picker.unknown} <span class="muted">{d.id}</span>
            </button>
          </li>
        {:else}
          <li class="muted">{t().app.picker.none}</li>
        {/each}
      </ul>
      <label>
        <input type="checkbox" bind:checked={showUnnamed} />
        {t().app.picker.showUnnamed(devices.filter((d) => !d.name).length)}
      </label>
      <div class="actions">
        <button onclick={() => window.cyclotron.bluetooth.cancelSelection()}
          >{t().common.actions.cancel}</button
        >
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
