<script lang="ts">
  // Settings → Strava (E12-7): the rider's own API app, connect, auto-upload.
  import type { StravaStatus } from '../../../shared/api'
  import { t } from '../i18n/t'

  let status = $state<StravaStatus | undefined>()
  let clientId = $state('')
  let clientSecret = $state('')
  let busy = $state(false)
  let note = $state<{ ok: boolean; text: string } | undefined>()
  const st = $derived(t().strava)

  $effect(() => {
    void window.cyclotron.strava.status().then((s) => (status = s))
  })

  async function run(action: () => Promise<StravaStatus>, okText?: (s: StravaStatus) => string) {
    busy = true
    note = undefined
    try {
      const s = await action()
      status = s
      if (s.error) note = { ok: false, text: st.errors[s.error] }
      else if (okText) note = { ok: true, text: okText(s) }
    } finally {
      busy = false
    }
  }
</script>

<section class="card">
  <h2>{st.title}</h2>
  <p class="muted">{st.intro}</p>

  {#if status?.connected}
    <p>{st.connected(status.athlete ?? '')}</p>
    <label class="block">
      <input
        type="checkbox"
        checked={status.auto}
        onchange={(e) => run(() => window.cyclotron.strava.setAuto(e.currentTarget.checked))}
      />
      {st.auto}
    </label>
    <div class="row">
      <button
        class="quiet"
        disabled={busy}
        onclick={() => run(() => window.cyclotron.strava.disconnect())}>{st.disconnect}</button
      >
    </div>
  {:else if status?.hasApp}
    <p class="muted">{st.appSaved(status.clientId ?? '')}</p>
    <div class="row">
      <button
        class="primary"
        disabled={busy}
        onclick={() =>
          run(
            () => window.cyclotron.strava.connect(),
            (s) => st.connected(s.athlete ?? ''),
          )}>{busy ? st.connecting : st.connect}</button
      >
      <button
        class="quiet"
        disabled={busy}
        onclick={() => run(() => window.cyclotron.strava.disconnect())}>{st.disconnect}</button
      >
    </div>
  {:else}
    <ol class="steps">
      {#each st.steps as step (step)}<li>{step}</li>{/each}
    </ol>
    <button onclick={() => window.open('https://www.strava.com/settings/api', '_blank')}
      >{st.openApiPage}</button
    >
    <form
      class="row"
      onsubmit={(e) => {
        e.preventDefault()
        void run(() => window.cyclotron.strava.setApp(clientId, clientSecret)).then(() => {
          if (status?.hasApp) clientSecret = ''
        })
      }}
    >
      <input
        placeholder={st.clientId}
        aria-label={st.clientId}
        bind:value={clientId}
        inputmode="numeric"
      />
      <input
        type="password"
        placeholder={st.clientSecret}
        aria-label={st.clientSecret}
        autocomplete="off"
        bind:value={clientSecret}
      />
      <button type="submit" disabled={busy}>{st.saveApp}</button>
    </form>
    <p class="muted">{st.stored}</p>
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
    min-width: 9rem;
  }
  .steps {
    margin: 0.25rem 0 0.5rem;
    padding-left: 1.25rem;
  }
  .block {
    display: block;
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
