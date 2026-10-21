<script lang="ts">
  // E5-4: shown after a ride is saved.
  import { caloriesKcal } from '@cyclotron/core'
  import type { RideFeedback } from '../../../shared/api'
  import { formatDuration } from '../lib/format'
  import { profile } from '../profile.svelte'
  import type { FinishedRide } from '../ride/recorder'

  let {
    result,
    onclose,
    ondiscard,
  }: { result: FinishedRide; onclose: () => void; ondiscard: () => void } = $props()

  const FEEDBACK: { value: RideFeedback; label: string }[] = [
    { value: 'easy', label: 'Too easy' },
    { value: 'right', label: 'Just right' },
    { value: 'hard', label: 'Hard' },
    { value: 'failed', label: "Couldn't finish" },
  ]

  let feedback = $state<RideFeedback | undefined>()
  let confirmDiscard = $state(false)
  /** E6-3: 'accepted' / 'kept' once the rider decided on the tested FTP. */
  let ftpDecision = $state<'accepted' | 'kept' | undefined>()

  function acceptFtp(ftpW: number): void {
    profile.setFtp(ftpW, result.ftpTest?.kind ?? 'manual', result.rideId)
    ftpDecision = 'accepted'
  }

  const s = $derived(result.summary)
  const round = (n: number | undefined): string => (n === undefined ? '–' : String(Math.round(n)))

  function giveFeedback(value: RideFeedback): void {
    feedback = value
    void window.cyclotron.rides.setFeedback(result.rideId, value)
  }
</script>

{#if result.ftpTest}
  {@const t = result.ftpTest}
  <section class="card ftp">
    <h2>FTP test result</h2>
    {#if t.ok}
      <p class="ftp-value">{t.ftpW} W</p>
      <p class="muted">
        {t.kind === 'ramp'
          ? `75 % of your best 1-minute power (${t.basisW} W).`
          : `95 % of your 20-minute average (${t.basisW} W).`}
        Your FTP was {result.info.ftpW} W ({t.ftpW >= result.info.ftpW ? '+' : ''}{t.ftpW -
          result.info.ftpW} W).
      </p>
      {#if ftpDecision === 'accepted'}
        <p class="ok">FTP set to {t.ftpW} W. Workouts now use it.</p>
      {:else if ftpDecision === 'kept'}
        <p class="muted">Kept {result.info.ftpW} W.</p>
      {:else}
        <div class="row">
          <button class="primary" onclick={() => acceptFtp(t.ftpW)}>Use {t.ftpW} W</button>
          <button onclick={() => (ftpDecision = 'kept')}>Keep {result.info.ftpW} W</button>
        </div>
      {/if}
    {:else}
      <p class="error">No result: {t.reason}</p>
    {/if}
  </section>
{/if}

<section class="card summary">
  <h2>Ride saved</h2>
  <dl class="stats">
    <div>
      <dt>Time</dt>
      <dd>{formatDuration(s.timerS)}</dd>
    </div>
    <div>
      <dt>Avg power</dt>
      <dd>{round(s.avgPowerW)} W</dd>
    </div>
    <div>
      <dt>NP</dt>
      <dd>{round(s.normalizedPowerW)} W</dd>
    </div>
    <div>
      <dt>IF</dt>
      <dd>{s.intensity.toFixed(2)}</dd>
    </div>
    <div>
      <dt>TSS</dt>
      <dd>{round(s.tss)}</dd>
    </div>
    <div>
      <dt>Calories</dt>
      <dd>{round(caloriesKcal(s.workKj))} kcal</dd>
    </div>
    <div>
      <dt>Avg / max HR</dt>
      <dd>{round(s.avgHeartRateBpm)} / {round(s.maxHeartRateBpm)}</dd>
    </div>
    <div>
      <dt>Avg cadence</dt>
      <dd>{round(s.avgCadenceRpm)} rpm</dd>
    </div>
    <div>
      <dt>Distance</dt>
      <dd>{(s.distanceM / 1000).toFixed(1)} km</dd>
    </div>
  </dl>

  {#if result.laps.length > 1}
    <table>
      <thead>
        <tr><th>Lap</th><th>Time</th><th>Avg W</th><th>Max W</th><th>Avg HR</th><th>Cadence</th></tr
        >
      </thead>
      <tbody>
        {#each result.laps as lap, i (i)}
          <tr>
            <td>{i + 1}</td>
            <td>{formatDuration(lap.summary.timerS)}</td>
            <td>{round(lap.summary.avgPowerW)}</td>
            <td>{round(lap.summary.maxPowerW)}</td>
            <td>{round(lap.summary.avgHeartRateBpm)}</td>
            <td>{round(lap.summary.avgCadenceRpm)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <p class="file">
    {#if result.fitPath}
      FIT file: <code>{result.fitPath}</code>
      <button onclick={() => window.cyclotron.rides.showFit(result.rideId)}>Show in folder</button>
    {:else}
      <span class="error">The FIT file couldn't be written: {result.fitError}</span>
    {/if}
  </p>

  <div class="row">
    <span class="muted">How did it feel?</span>
    {#each FEEDBACK as f (f.value)}
      <button class:chosen={feedback === f.value} onclick={() => giveFeedback(f.value)}>
        {f.label}
      </button>
    {/each}
  </div>

  <div class="row actions">
    <button class="primary" onclick={onclose}>Done</button>
    {#if confirmDiscard}
      <span class="error">Delete this ride and its FIT file?</span>
      <button onclick={ondiscard}>Delete</button>
      <button onclick={() => (confirmDiscard = false)}>Keep</button>
    {:else}
      <button onclick={() => (confirmDiscard = true)}>Discard ride…</button>
    {/if}
  </div>
</section>

<style>
  .summary,
  .ftp {
    max-width: 48rem;
  }
  .ftp-value {
    font-size: 2.6rem;
    font-weight: 600;
    margin: 0;
  }
  .ok {
    color: var(--ok);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
    gap: 0.75rem;
    margin: 0 0 1rem;
  }
  dt {
    color: var(--muted);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  dd {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  table {
    border-collapse: collapse;
    margin-bottom: 1rem;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 0.2rem 0.75rem 0.2rem 0;
    text-align: right;
  }
  th {
    color: var(--muted);
    font-weight: normal;
    font-size: 0.85rem;
  }
  .file code {
    font-size: 0.85rem;
    word-break: break-all;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  .chosen {
    outline: 2px solid var(--ok);
  }
  .primary {
    font-weight: 600;
  }
  .error {
    color: var(--error);
  }
</style>
