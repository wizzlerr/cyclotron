<script lang="ts">
  // Local ride list. The full history (power curve, fitness chart) comes from the server in E9.
  import type { StoredRide } from '../../../shared/api'
  import { formatDuration } from '../lib/format'

  let rides = $state.raw<StoredRide[]>([])
  let loaded = $state(false)

  $effect(() => {
    void window.cyclotron.rides.list(200).then((r) => {
      rides = r
      loaded = true
    })
  })

  const date = (ms: number): string =>
    new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  const round = (n: number | undefined): string => (n === undefined ? '–' : String(Math.round(n)))
</script>

<h1>History</h1>

{#if loaded && rides.length === 0}
  <p class="muted">
    No rides yet. Finished rides appear here, and their FIT files in your ride folder.
  </p>
{:else if rides.length > 0}
  <table>
    <thead>
      <tr>
        <th class="left">Date</th>
        <th class="left">Ride</th>
        <th>Time</th>
        <th>Avg W</th>
        <th>NP</th>
        <th>IF</th>
        <th>TSS</th>
        <th>Avg HR</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each rides as r (r.id)}
        <tr>
          <td class="left">{date(r.startedAt)}</td>
          <td class="left">{r.workoutName}</td>
          <td>{formatDuration(r.totals?.timerS ?? 0)}</td>
          <td>{round(r.totals?.avgPowerW)}</td>
          <td>{round(r.totals?.npW)}</td>
          <td>{r.totals ? r.totals.intensity.toFixed(2) : '–'}</td>
          <td>{round(r.totals?.tss)}</td>
          <td>{round(r.totals?.avgHrBpm)}</td>
          <td>
            {#if r.fitPath}
              <button onclick={() => window.cyclotron.rides.showFit(r.id)}>FIT</button>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<style>
  table {
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 0.35rem 0.75rem;
    text-align: right;
    border-bottom: 1px solid var(--panel);
  }
  th {
    color: var(--muted);
    font-weight: normal;
    font-size: 0.85rem;
  }
  .left {
    text-align: left;
  }
</style>
