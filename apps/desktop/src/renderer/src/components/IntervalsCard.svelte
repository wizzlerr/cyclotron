<script lang="ts">
  // Settings → intervals.icu (E18): the rider's API key, auto-upload, FTP, how it meets the plan.
  import type { IntervalsStatus } from '../../../shared/api'
  import { formatDateTime } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { profile } from '../profile.svelte'
  import { planned } from '../workouts/planned.svelte'

  let status = $state<IntervalsStatus | undefined>()
  let key = $state('')
  let busy = $state(false)
  let note = $state<{ ok: boolean; text: string } | undefined>()
  const it = $derived(t().intervals)

  $effect(() => {
    void window.cyclotron.intervals.status().then((s) => (status = s))
  })

  const errorText = (s: IntervalsStatus): string =>
    s.error === 'http' && s.status ? `${it.errors.http} (${s.status}).` : it.errors[s.error!]

  async function run(
    action: () => Promise<IntervalsStatus>,
    okText?: (s: IntervalsStatus) => string,
  ): Promise<void> {
    busy = true
    note = undefined
    try {
      const s = await action()
      status = s
      if (s.error) note = { ok: false, text: errorText(s) }
      else if (okText) note = { ok: true, text: okText(s) }
    } finally {
      busy = false
    }
  }

  async function connect(): Promise<void> {
    await run(() => window.cyclotron.intervals.setKey(key))
    if (status?.connected && !status.error) {
      key = ''
      // Main fetched the planned rides while checking the key; pick them up.
      void planned.refresh('none')
    }
  }

  async function disconnect(): Promise<void> {
    await run(() => window.cyclotron.intervals.disconnect())
    void planned.refresh('none')
  }
</script>

<section class="card">
  <h2>{it.title}</h2>
  <p class="muted">{it.intro}</p>
  <details class="how">
    <summary>{it.howTitle}</summary>
    <ul>
      {#each it.how as line (line)}<li>{line}</li>{/each}
    </ul>
  </details>

  {#if status?.connected}
    <p>
      {it.connected(status.athlete ?? '', status.keyHint ?? '')}
      {#if status.lastOkAt}<span class="muted">{it.lastOk(formatDateTime(status.lastOkAt))}</span
        >{/if}
    </p>
    <label class="block">
      <input
        type="checkbox"
        checked={status.auto}
        onchange={(e) => run(() => window.cyclotron.intervals.setAuto(e.currentTarget.checked))}
      />
      {it.auto}
    </label>
    <p class="muted">{it.autoHint}</p>
    <h3>{it.ftpTitle}</h3>
    {#if !status.ftpW}
      <p class="muted">{it.ftpUnknown}</p>
    {:else if status.ftpW === profile.ftpW}
      <p class="muted">{it.ftpSame(profile.ftpW)}</p>
    {:else}
      <p>{it.ftpDiffers(status.ftpW, profile.ftpW)}</p>
    {/if}
    {#if status.ftpW !== profile.ftpW}
      <div class="row">
        {#if status.ftpW}
          <button disabled={busy} onclick={() => profile.setFtp(status!.ftpW!)}
            >{it.ftpUseHere(status.ftpW)}</button
          >
        {/if}
        <button
          disabled={busy}
          onclick={() =>
            run(
              () => window.cyclotron.intervals.setFtp(profile.ftpW),
              (s) => it.ftpSent(s.ftpW ?? profile.ftpW),
            )}>{it.ftpSend(profile.ftpW)}</button
        >
      </div>
    {/if}
    <div class="row">
      <button onclick={() => window.cyclotron.intervals.openCalendar()}
        >{it.planned.calendar}</button
      >
      <button class="quiet" disabled={busy} onclick={disconnect}>{it.disconnect}</button>
    </div>
  {:else}
    <ol class="steps">
      {#each it.steps as step (step)}<li>{step}</li>{/each}
    </ol>
    <button onclick={() => window.open('https://intervals.icu/settings', '_blank')}
      >{it.openSettings}</button
    >
    <form
      class="row"
      onsubmit={(e) => {
        e.preventDefault()
        void connect()
      }}
    >
      <input
        type="password"
        placeholder={it.key}
        aria-label={it.key}
        autocomplete="off"
        bind:value={key}
      />
      <button type="submit" class="primary" disabled={busy || key.trim().length === 0}
        >{busy ? it.connecting : it.connect}</button
      >
    </form>
    <p class="muted">{it.stored}</p>
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
  .row input {
    flex: 1;
    min-width: 12rem;
  }
  .steps {
    margin: 0.25rem 0 0.5rem;
    padding-left: 1.25rem;
  }
  .block {
    display: block;
  }
  .how {
    margin: 0.5rem 0;
  }
  .how summary {
    cursor: pointer;
  }
  .how ul {
    margin: 0.35rem 0 0;
    padding-left: 1.25rem;
    color: var(--muted);
  }
  .how li + li {
    margin-top: 0.25rem;
  }
  h3 {
    font-size: 0.9rem;
    margin: 1rem 0 0.25rem;
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
