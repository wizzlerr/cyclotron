<script lang="ts">
  // E9-1: one ride in full: stats, power/HR (and elevation) over time, power curve, zones, laps.
  import {
    buildRoute,
    caloriesKcal,
    POWER_ZONES,
    rideLaps,
    summarizeRide,
    type Route,
  } from '@cyclotron/core'
  import type uPlot from 'uplot'
  import type { RideDetail } from '../../../shared/api'
  import { axis, cssVar, durationAxis, line, series } from '../lib/chart'
  import { durationLabel, formatDuration } from '../lib/format'
  import Chart from './Chart.svelte'
  import RouteMap from './RouteMap.svelte'

  let {
    detail,
    onclose,
    ondelete,
  }: { detail: RideDetail; onclose: () => void; ondelete: () => void } = $props()

  let confirmDelete = $state(false)

  const ride = $derived(detail.ride)
  const samples = $derived(detail.samples)
  const summary = $derived(summarizeRide(samples, ride.ftpW))
  const laps = $derived(rideLaps(samples))
  const hasHr = $derived(samples.some((s) => s.heartRateBpm))
  const hasAlt = $derived(samples.some((s) => s.altitudeM !== undefined))
  const route = $derived.by((): Route | undefined => {
    const pts = samples
      .filter((s) => s.lat !== undefined && s.lon !== undefined)
      .map((s) => ({ lat: s.lat!, lon: s.lon!, ele: s.altitudeM }))
    try {
      return pts.length > 1
        ? buildRoute({ id: `ride-${ride.id}`, name: ride.workoutName, source: 'gpx' }, pts)
        : undefined
    } catch {
      return undefined
    }
  })

  const date = (ms: number): string =>
    new Date(ms).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })
  const round = (n: number | undefined): string => (n === undefined ? '–' : String(Math.round(n)))
  const mmss = (_u: uPlot, splits: number[]): string[] => splits.map((s) => formatDuration(s))

  // Small multiples with one y-axis each and a shared, synced time cursor (no dual axes).
  const cursor = { sync: { key: 'ride-detail' }, drag: { x: true, y: false } }
  const t = $derived(samples.map((s) => s.t))
  const powerData = $derived<uPlot.AlignedData>([
    t,
    samples.map((s) => (s.paused ? null : (s.powerW ?? null))),
    samples.map((s) => s.targetW ?? null),
  ])
  const hrData = $derived<uPlot.AlignedData>([t, samples.map((s) => s.heartRateBpm ?? null)])
  const altData = $derived<uPlot.AlignedData>([t, samples.map((s) => s.altitudeM ?? null)])

  const timeAxis = (): uPlot.Axis => axis({ values: mmss })
  const powerOptions: Omit<uPlot.Options, 'width' | 'height'> = {
    cursor,
    scales: { x: { time: false }, y: { range: (_u, _min, max) => [0, Math.max(100, max * 1.1)] } },
    axes: [timeAxis(), axis({ label: 'Power (W)', size: 60 })],
    series: [
      { label: 'Time', value: (_u, v) => (v == null ? '–' : formatDuration(v)) },
      line('Power', series(1), { width: 1.5, value: (_u, v) => (v == null ? '–' : `${v} W`) }),
      line('Target', series(2), {
        width: 1.5,
        value: (_u, v) => (v == null ? '–' : `${v} W`),
      }),
    ],
  }
  const hrOptions: Omit<uPlot.Options, 'width' | 'height'> = {
    cursor,
    scales: { x: { time: false } },
    axes: [timeAxis(), axis({ label: 'Heart rate (bpm)', size: 60 })],
    series: [
      { label: 'Time', value: (_u, v) => (v == null ? '–' : formatDuration(v)) },
      line('Heart rate', cssVar('--z6'), { value: (_u, v) => (v == null ? '–' : `${v} bpm`) }),
    ],
  }
  const altOptions: Omit<uPlot.Options, 'width' | 'height'> = {
    cursor,
    scales: { x: { time: false } },
    axes: [timeAxis(), axis({ label: 'Elevation (m)', size: 60 })],
    series: [
      { label: 'Time', value: (_u, v) => (v == null ? '–' : formatDuration(v)) },
      line('Elevation', series(3), {
        fill: 'rgba(25, 158, 112, 0.15)',
        value: (_u, v) => (v == null ? '–' : `${Math.round(v)} m`),
      }),
    ],
  }

  const curveData = $derived<uPlot.AlignedData>([
    detail.curve.map((p) => p.durationS),
    detail.curve.map((p) => p.watts),
  ])
  const curveOptions: Omit<uPlot.Options, 'width' | 'height'> = {
    scales: {
      x: { time: false, distr: 3, log: 10 },
      y: { range: (_u, _min, max) => [0, max * 1.1] },
    },
    axes: [durationAxis(durationLabel), axis({ label: 'Best power (W)', size: 60 })],
    series: [
      { label: 'Duration', value: (_u, v) => (v == null ? '–' : durationLabel(v)) },
      line('Best power', series(1), {
        points: { show: true, size: 8 },
        value: (_u, v) => (v == null ? '–' : `${Math.round(v)} W`),
      }),
    ],
  }

  const zoneTotal = $derived(
    Math.max(
      1,
      detail.zones.reduce((a, b) => a + b, 0),
    ),
  )
</script>

<div class="head">
  <button onclick={onclose}>← History</button>
  <div>
    <h1>{ride.workoutName}</h1>
    <p class="muted">
      {date(ride.startedAt)} · FTP {ride.ftpW} W{ride.source === 'import' ? ' · imported' : ''}
    </p>
  </div>
</div>

<dl class="stats">
  <div>
    <dt>Time</dt>
    <dd>{formatDuration(summary.timerS)}</dd>
  </div>
  <div>
    <dt>Avg power</dt>
    <dd>{round(summary.avgPowerW)} W</dd>
  </div>
  <div>
    <dt>NP</dt>
    <dd>{round(summary.normalizedPowerW)} W</dd>
  </div>
  <div>
    <dt>IF</dt>
    <dd>{summary.intensity.toFixed(2)}</dd>
  </div>
  <div>
    <dt>TSS</dt>
    <dd>{round(summary.tss)}</dd>
  </div>
  <div>
    <dt>Calories</dt>
    <dd>{round(caloriesKcal(summary.workKj))} kcal</dd>
  </div>
  <div>
    <dt>Avg / max HR</dt>
    <dd>{round(summary.avgHeartRateBpm)} / {round(summary.maxHeartRateBpm)}</dd>
  </div>
  <div>
    <dt>Distance</dt>
    <dd>{(summary.distanceM / 1000).toFixed(1)} km</dd>
  </div>
  {#if summary.ascentM !== undefined}
    <div>
      <dt>Climbing</dt>
      <dd>{round(summary.ascentM)} m</dd>
    </div>
  {/if}
</dl>

<section class="card wide">
  <h2>Power</h2>
  <Chart options={powerOptions} data={powerData} height={200} />
  {#if hasHr}
    <h2 class="next">Heart rate</h2>
    <Chart options={hrOptions} data={hrData} height={140} />
  {/if}
  {#if hasAlt}
    <h2 class="next">Elevation</h2>
    <Chart options={altOptions} data={altData} height={120} />
  {/if}
</section>

<div class="row">
  {#if detail.curve.length > 0}
    <section class="card">
      <h2>Power curve</h2>
      <Chart options={curveOptions} data={curveData} height={220} />
    </section>
  {/if}

  <section class="card">
    <h2>Time in zones</h2>
    <ul class="zones">
      {#each POWER_ZONES as z, i (z.zone)}
        {@const s = detail.zones[i] ?? 0}
        <li>
          <span class="zone-name">Z{z.zone} {z.name}</span>
          <span class="bar"
            ><span style:width="{(s / zoneTotal) * 100}%" style:background="var(--z{z.zone})"
            ></span></span
          >
          <span class="zone-time">{formatDuration(s)}</span>
        </li>
      {/each}
    </ul>
  </section>

  {#if route}
    <section class="card route">
      <h2>Route</h2>
      <RouteMap {route} size={220} />
    </section>
  {/if}
</div>

{#if laps.length > 1}
  <section class="card wide">
    <h2>Laps</h2>
    <table>
      <thead>
        <tr><th>Lap</th><th>Time</th><th>Avg W</th><th>Max W</th><th>Avg HR</th><th>Cadence</th></tr
        >
      </thead>
      <tbody>
        {#each laps as lap, i (i)}
          <tr>
            <td>{i + 1}</td>
            <td>{formatDuration(lap.summary.elapsedS)}</td>
            <td>{round(lap.summary.avgPowerW)}</td>
            <td>{round(lap.summary.maxPowerW)}</td>
            <td>{round(lap.summary.avgHeartRateBpm)}</td>
            <td>{round(lap.summary.avgCadenceRpm)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
{/if}

<div class="actions">
  {#if ride.fitPath}
    <button onclick={() => window.cyclotron.rides.showFit(ride.id)}>Show FIT file</button>
  {/if}
  {#if confirmDelete}
    <span class="warn">Delete this ride and its FIT file?</span>
    <button onclick={ondelete}>Delete</button>
    <button onclick={() => (confirmDelete = false)}>Keep</button>
  {:else}
    <button onclick={() => (confirmDelete = true)}>Delete ride…</button>
  {/if}
</div>

<style>
  .head {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }
  .head h1 {
    margin: 0;
  }
  .head p {
    margin: 0.25rem 0 1rem;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: 0.75rem;
    margin: 0 0 1rem;
  }
  dt {
    color: var(--muted);
    font-size: 0.8rem;
    text-transform: uppercase;
  }
  dd {
    margin: 0;
    font-size: 1.3rem;
    font-variant-numeric: tabular-nums;
  }
  .wide {
    max-width: none;
  }
  .next {
    margin-top: 1rem;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .row .card {
    max-width: none;
    margin: 0;
  }
  .zones {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.4rem;
  }
  .zones li {
    display: grid;
    grid-template-columns: 9rem 1fr 4.5rem;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9rem;
  }
  .zone-time {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .bar {
    height: 0.8rem;
    background: var(--bg);
    border-radius: 4px;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    border-radius: 4px;
  }
  table {
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 0.3rem 0.75rem;
    text-align: right;
  }
  th {
    color: var(--muted);
    font-weight: normal;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 2rem;
  }
  .warn {
    color: var(--warn);
  }
</style>
