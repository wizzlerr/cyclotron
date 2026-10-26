<script lang="ts">
  // "Send to intervals.icu" for one ride (E18); shown only once intervals.icu is connected.
  import type { IntervalsStatus } from '../../../shared/api'
  import { t } from '../i18n/t'

  let { rideId, intervalsId }: { rideId: number; intervalsId?: string } = $props()

  let connected = $state(false)
  let busy = $state(false)
  // Set after an upload from here.
  let uploaded = $state<string | undefined>()
  let error = $state<string | undefined>()
  const it = $derived(t().intervals)
  const id = $derived(uploaded ?? intervalsId)

  $effect(() => {
    void window.cyclotron.intervals.status().then((s) => (connected = s.connected))
  })

  async function send(): Promise<void> {
    busy = true
    error = undefined
    try {
      const s: IntervalsStatus = await window.cyclotron.intervals.upload(rideId)
      if (s.error) error = it.errors[s.error]
      else uploaded = s.activityUrl?.split('/').pop()
    } finally {
      busy = false
    }
  }
</script>

{#if id}
  <button onclick={() => window.cyclotron.intervals.openActivity(id)}>{it.onIntervals}</button>
{:else if connected}
  <button onclick={send} disabled={busy}>{busy ? it.sending : it.send}</button>
  {#if error}<span class="error">{error}</span>{/if}
{/if}

<style>
  .error {
    color: var(--error);
    font-size: 0.85rem;
  }
</style>
