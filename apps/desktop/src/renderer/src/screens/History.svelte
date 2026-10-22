<script lang="ts">
  // E9-1/E9-5: ride history, ride detail and FIT import. Analytics are on the Progress screen.
  import type { RideDetail as Detail, StoredRide } from '../../../shared/api'
  import RideDetail from '../components/RideDetail.svelte'
  import { formatDateTime, formatNumber } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { formatDuration, formatKm } from '../lib/format'

  let rides = $state.raw<StoredRide[]>([])
  let loaded = $state(false)
  let detail = $state.raw<Detail | undefined>()
  let message = $state<string | undefined>()
  let skipped = $state.raw<string[]>([])
  let importing = $state(false)

  async function reload(): Promise<void> {
    rides = await window.cyclotron.rides.list(1000)
    loaded = true
  }

  $effect(() => {
    void reload()
  })

  async function open(id: number): Promise<void> {
    detail = (await window.cyclotron.rides.detail(id)) ?? undefined
  }

  async function remove(): Promise<void> {
    if (!detail) return
    await window.cyclotron.rides.discard(detail.ride.id)
    detail = undefined
    await reload()
  }

  async function importFit(): Promise<void> {
    importing = true
    message = undefined
    skipped = []
    try {
      const r = await window.cyclotron.rides.importFit()
      if (r.imported > 0 || r.skipped.length > 0) {
        message = t().history.history.imported(r.imported)
        skipped = r.skipped
      }
      await reload()
    } catch (e) {
      message = t().history.history.importFailed(e instanceof Error ? e.message : String(e))
    } finally {
      importing = false
    }
  }

  const round = (n: number | undefined): string => (n === undefined ? '–' : String(Math.round(n)))
</script>

{#if detail}
  <RideDetail {detail} onclose={() => (detail = undefined)} ondelete={remove} />
{:else}
  <div class="head">
    <h1>{t().history.history.title}</h1>
    <button onclick={importFit} disabled={importing}>
      {importing ? t().history.history.importing : t().history.history.importFit}
    </button>
  </div>

  {#if message}<p class="muted">{message}</p>{/if}
  {#if skipped.length > 0}
    <details class="muted">
      <summary>{t().history.history.skipped(skipped.length)}</summary>
      <ul>
        {#each skipped as s (s)}<li>{s}</li>{/each}
      </ul>
    </details>
  {/if}

  {#if loaded && rides.length === 0}
    <p class="muted">{t().history.history.empty}</p>
  {:else if rides.length > 0}
    <table>
      <thead>
        <tr>
          <th class="left">{t().history.history.cols.date}</th>
          <th class="left">{t().history.history.cols.ride}</th>
          <th>{t().history.history.cols.time}</th>
          <th>{t().history.history.cols.distance}</th>
          <th>{t().history.history.cols.avgW}</th>
          <th>NP</th>
          <th>IF</th>
          <th>TSS</th>
          <th>{t().history.history.cols.avgHr}</th>
        </tr>
      </thead>
      <tbody>
        {#each rides as r (r.id)}
          <!-- The ride name is the keyboard-accessible button; the row is just a bigger target. -->
          <tr onclick={() => open(r.id)}>
            <td class="left">{formatDateTime(r.startedAt)}</td>
            <td class="left">
              <button class="link" onclick={(e) => (e.stopPropagation(), open(r.id))}>
                {r.workoutName}
              </button>
              {#if r.source === 'import'}<span class="tag">{t().history.history.importedTag}</span
                >{/if}
            </td>
            <td>{formatDuration(r.totals?.timerS ?? 0)}</td>
            <td>{r.totals ? formatKm(r.totals.distanceM) : '–'}</td>
            <td>{round(r.totals?.avgPowerW)}</td>
            <td>{round(r.totals?.npW)}</td>
            <td>{r.totals ? formatNumber(r.totals.intensity, 2) : '–'}</td>
            <td>{round(r.totals?.tss)}</td>
            <td>{round(r.totals?.avgHrBpm)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .head h1 {
    margin: 0 0 1rem;
  }
  table {
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
    width: 100%;
  }
  th,
  td {
    padding: 0.4rem 0.75rem;
    text-align: right;
    border-bottom: 1px solid var(--panel);
  }
  tbody tr {
    cursor: pointer;
  }
  tbody tr:hover {
    background: var(--panel);
  }
  th {
    color: var(--muted);
    font-weight: normal;
    font-size: 0.85rem;
  }
  .left {
    text-align: left;
  }
  .link {
    background: none;
    border: none;
    padding: 0;
    color: var(--fg);
    font: inherit;
    cursor: pointer;
    text-align: left;
  }
  .link:hover {
    text-decoration: underline;
  }
  .tag {
    margin-left: 0.4rem;
    font-size: 0.7rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
