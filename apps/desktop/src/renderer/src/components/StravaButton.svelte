<script lang="ts">
  // "Send to Strava" for one ride (E12-7); shown only once Strava is connected.
  import type { StravaStatus } from '../../../shared/api'
  import { t } from '../i18n/t'

  let { rideId, stravaId }: { rideId: number; stravaId?: number } = $props()

  let connected = $state(false)
  let busy = $state(false)
  // Set after an upload from here.
  let uploaded = $state<number | undefined>()
  let error = $state<string | undefined>()
  const st = $derived(t().strava)
  const id = $derived(uploaded ?? stravaId)

  $effect(() => {
    void window.cyclotron.strava.status().then((s) => (connected = s.connected))
  })

  async function send(): Promise<void> {
    busy = true
    error = undefined
    try {
      const s: StravaStatus = await window.cyclotron.strava.upload(rideId)
      if (s.error) error = st.errors[s.error]
      else uploaded = Number(s.activityUrl?.split('/').pop())
    } finally {
      busy = false
    }
  }
</script>

{#if id}
  <button onclick={() => window.cyclotron.strava.openActivity(id)}>{st.onStrava}</button>
{:else if connected}
  <button onclick={send} disabled={busy}>{busy ? st.sending : st.send}</button>
  {#if error}<span class="error">{error}</span>{/if}
{/if}

<style>
  .error {
    color: var(--error);
    font-size: 0.85rem;
  }
</style>
