<script lang="ts">
  // E5-4: shown after a ride is saved.
  import { caloriesKcal } from '@cyclotron/core'
  import type { RideFeedback } from '../../../shared/api'
  import { formatNumber } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { formatDuration } from '../lib/format'
  import { profile } from '../profile.svelte'
  import type { FinishedRide } from '../ride/recorder'

  let {
    result,
    onclose,
    ondiscard,
  }: { result: FinishedRide; onclose: () => void; ondiscard: () => void } = $props()

  const FEEDBACK: RideFeedback[] = ['easy', 'right', 'hard', 'failed']

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
  {@const test = result.ftpTest}
  {@const L = t().ride.summary}
  <section class="card ftp">
    <h2>{L.ftpResult}</h2>
    {#if test.ok}
      <p class="ftp-value">{test.ftpW} W</p>
      <p class="muted">
        {test.kind === 'ramp' ? L.rampBasis(test.basisW) : L.twentyBasis(test.basisW)}
        {L.ftpWas(
          result.info.ftpW,
          `${test.ftpW >= result.info.ftpW ? '+' : ''}${test.ftpW - result.info.ftpW}`,
        )}
      </p>
      {#if ftpDecision === 'accepted'}
        <p class="ok">{L.ftpSet(test.ftpW)}</p>
      {:else if ftpDecision === 'kept'}
        <p class="muted">{L.kept(result.info.ftpW)}</p>
      {:else}
        <div class="row">
          <button class="primary" onclick={() => acceptFtp(test.ftpW)}>{L.use(test.ftpW)}</button>
          <button onclick={() => (ftpDecision = 'kept')}>{L.keep(result.info.ftpW)}</button>
        </div>
      {/if}
    {:else}
      <!-- core has one failure reason per test kind; word it here (DESIGN.md D21). -->
      <p class="error">
        {L.noResult(test.kind === 'ramp' ? L.rampTooShort : L.twentyIncomplete)}
      </p>
    {/if}
  </section>
{/if}

<section class="card summary">
  <h2>{t().ride.summary.saved}</h2>
  <dl class="stats">
    <div>
      <dt>{t().ride.summary.time}</dt>
      <dd>{formatDuration(s.timerS)}</dd>
    </div>
    <div>
      <dt>{t().ride.summary.avgPower}</dt>
      <dd>{round(s.avgPowerW)} W</dd>
    </div>
    <div>
      <dt>NP</dt>
      <dd>{round(s.normalizedPowerW)} W</dd>
    </div>
    <div>
      <dt>IF</dt>
      <dd>{formatNumber(s.intensity, 2)}</dd>
    </div>
    <div>
      <dt>TSS</dt>
      <dd>{round(s.tss)}</dd>
    </div>
    <div>
      <dt>{t().ride.summary.calories}</dt>
      <dd>{round(caloriesKcal(s.workKj))} kcal</dd>
    </div>
    <div>
      <dt>{t().ride.summary.avgMaxHr}</dt>
      <dd>{round(s.avgHeartRateBpm)} / {round(s.maxHeartRateBpm)}</dd>
    </div>
    <div>
      <dt>{t().ride.summary.avgCadence}</dt>
      <dd>{round(s.avgCadenceRpm)} rpm</dd>
    </div>
    <div>
      <dt>{t().ride.summary.distance}</dt>
      <dd>{formatNumber(s.distanceM / 1000, 1)} km</dd>
    </div>
    {#if s.ascentM !== undefined}
      <div>
        <dt>{t().ride.summary.climbing}</dt>
        <dd>{Math.round(s.ascentM)} m</dd>
      </div>
    {/if}
  </dl>

  {#if result.laps.length > 1}
    <table>
      <thead>
        <tr>
          <th>{t().ride.summary.lap}</th>
          <th>{t().ride.summary.time}</th>
          <th>{t().ride.summary.avgW}</th>
          <th>{t().ride.summary.maxW}</th>
          <th>{t().ride.summary.avgHr}</th>
          <th>{t().ride.summary.cadence}</th>
        </tr>
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
      {t().ride.summary.fitFile} <code>{result.fitPath}</code>
      <button onclick={() => window.cyclotron.rides.showFit(result.rideId)}>
        {t().ride.summary.showInFolder}
      </button>
    {:else}
      <span class="error">{t().ride.summary.fitFailed(result.fitError ?? '')}</span>
    {/if}
  </p>

  <div class="row">
    <span class="muted">{t().ride.summary.howDidItFeel}</span>
    {#each FEEDBACK as f (f)}
      <button class:chosen={feedback === f} onclick={() => giveFeedback(f)}>
        {t().ride.summary.feedback[f]}
      </button>
    {/each}
  </div>

  <div class="row actions">
    <button class="primary" onclick={onclose}>{t().ride.summary.done}</button>
    {#if confirmDiscard}
      <span class="error">{t().ride.summary.confirmDiscard}</span>
      <button onclick={ondiscard}>{t().common.actions.delete}</button>
      <button onclick={() => (confirmDiscard = false)}>{t().ride.summary.keepRide}</button>
    {:else}
      <button onclick={() => (confirmDiscard = true)}>{t().ride.summary.discard}</button>
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
