<script lang="ts">
  // Settings → Profile → Your data (E19): export, import and delete everything. Import and delete
  // ask first; main reloads the window afterwards.
  import type { DataResult } from '../../../shared/api'
  import { t } from '../i18n/t'
  import { ride } from '../ride/session.svelte'

  let busy = $state(false)
  let confirming = $state<'import' | 'wipe' | undefined>()
  let note = $state<{ ok: boolean; text: string } | undefined>()
  const d = $derived(t().app.settings.data)

  async function run(action: () => Promise<DataResult>): Promise<void> {
    busy = true
    note = undefined
    confirming = undefined
    try {
      const r = await action()
      if (r.error) note = { ok: false, text: d.errors[r.error] }
      else if (r.ok && r.path) note = { ok: true, text: d.exported(r.path) }
    } finally {
      busy = false
    }
  }
</script>

<section class="card">
  <h2>{d.title}</h2>
  <p class="muted">{d.intro}</p>
  {#if ride.active}
    <p class="muted">{d.duringRide}</p>
  {:else if confirming}
    <p class="warn">{confirming === 'import' ? d.importConfirm : d.wipeConfirm}</p>
    <div class="row">
      {#if confirming === 'import'}
        <button class="primary" disabled={busy} onclick={() => run(window.cyclotron.data.import)}
          >{d.confirmImport}</button
        >
      {:else}
        <button class="danger" disabled={busy} onclick={() => run(window.cyclotron.data.wipe)}
          >{d.confirmWipe}</button
        >
      {/if}
      <button disabled={busy} onclick={() => (confirming = undefined)}>{d.cancel}</button>
    </div>
  {:else}
    <div class="row">
      <button disabled={busy} onclick={() => run(window.cyclotron.data.export)}>{d.export}</button>
      <button disabled={busy} onclick={() => (confirming = 'import')}>{d.import}</button>
      <button class="quiet" disabled={busy} onclick={() => (confirming = 'wipe')}>{d.wipe}</button>
    </div>
  {/if}
  {#if note}<p class:error={!note.ok} class:ok={note.ok}>{note.text}</p>{/if}
</section>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin: 0.5rem 0;
  }
  .quiet {
    margin-left: auto;
  }
  .danger {
    color: var(--error);
  }
  .warn {
    color: var(--warn);
  }
  .error {
    color: var(--error);
  }
  .ok {
    color: var(--ok);
    word-break: break-all;
  }
</style>
