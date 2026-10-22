<script lang="ts">
  // Settings → Garmin Connect (E12-5): the rider's Personal API key, test, sample data.
  import type { GarminStatus } from '../../../shared/api'
  import { formatDateTime } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'

  let status = $state<GarminStatus | undefined>()
  let key = $state('')
  let busy = $state(false)
  /** Message from the last action: ok text or a worded error. */
  let message = $state<{ ok: boolean; text: string } | undefined>()

  const g = $derived(t().garmin)

  $effect(() => {
    void window.cyclotron.garmin.status().then((s) => (status = s))
  })

  async function run(action: () => Promise<GarminStatus>, okText?: (s: GarminStatus) => string) {
    busy = true
    message = undefined
    try {
      const s = await action()
      status = s
      if (s.error) {
        const text = g.errors[s.error]
        message = { ok: false, text: s.status ? `${text} (${s.status}).` : text }
      } else if (okText) {
        message = { ok: true, text: okText(s) }
      }
    } finally {
      busy = false
    }
  }

  async function sync(): Promise<void> {
    // The Today card refreshes itself when main reports the sync.
    await run(() => window.cyclotron.garmin.sync())
  }

  async function connect(): Promise<void> {
    await run(
      () => window.cyclotron.garmin.setKey(key),
      () => g.ok,
    )
    // Don't keep the key in the page once it's saved; pull the history right away.
    if (status?.connected) {
      key = ''
      await sync()
    }
  }
</script>

<section class="card">
  <h2>{g.title}</h2>
  <p class="muted">{g.intro}</p>

  {#if status?.connected}
    <p>
      {g.connected(status.keyHint ?? '')}
      {#if status.lastOkAt}<span class="muted">{g.lastOk(formatDateTime(status.lastOkAt))}</span
        >{/if}
    </p>
    <p class="muted">
      {status.lastSyncAt
        ? g.synced(formatDateTime(status.lastSyncAt), status.activities ?? 0)
        : g.neverSynced}
    </p>
    <div class="row">
      <button class="primary" disabled={busy} onclick={sync}>{g.sync}</button>
      <button
        disabled={busy}
        onclick={() =>
          run(
            () => window.cyclotron.garmin.test(),
            () => g.ok,
          )}>{g.test}</button
      >
      <button
        disabled={busy}
        onclick={() =>
          run(
            () => window.cyclotron.garmin.saveSample(),
            (s) => g.sampleSaved(s.file ?? ''),
          )}>{g.sample}</button
      >
      <button
        class="quiet"
        disabled={busy}
        onclick={() => run(() => window.cyclotron.garmin.clearKey())}>{g.disconnect}</button
      >
    </div>
    <p class="muted">{g.syncHint}</p>
    <p class="muted">{g.sampleHint}</p>
    <p class="muted">{g.expiryNote}</p>
  {:else}
    <p class="muted">{g.howTo}</p>
    <form
      class="row"
      onsubmit={(e) => {
        e.preventDefault()
        void connect()
      }}
    >
      <input
        type="password"
        autocomplete="off"
        spellcheck="false"
        placeholder={g.keyPlaceholder}
        aria-label={g.keyLabel}
        bind:value={key}
      />
      <button class="primary" type="submit" disabled={busy || key.trim().length < 8}
        >{g.save}</button
      >
    </form>
    <p class="muted">{g.stored}</p>
  {/if}

  {#if message}<p class:error={!message.ok} class:ok={message.ok}>{message.text}</p>{/if}
</section>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin: 0.5rem 0;
  }
  .row input {
    flex: 1;
    min-width: 12rem;
  }
  .quiet {
    margin-left: auto;
  }
  .error {
    color: var(--error);
  }
  .ok {
    color: var(--ok);
  }
</style>
