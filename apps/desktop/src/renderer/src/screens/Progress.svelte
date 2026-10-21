<script lang="ts">
  // E9-2…E9-4, E9-6: power curve, fitness/fatigue/form, weekly time in zones, FTP estimate.
  // Everything is computed on this computer from local rides (D19).
  import uPlot from 'uplot'
  import type { BestPower, DailyLoad, FtpEstimate, WeekZones } from '../../../shared/api'
  import Chart from '../components/Chart.svelte'
  import Tile from '../components/Tile.svelte'
  import { axis, durationAxis, line, series } from '../lib/chart'
  import { durationLabel } from '../lib/format'
  import { profile } from '../profile.svelte'

  let load = $state.raw<DailyLoad[]>([])
  let curves = $state.raw<{ all: BestPower[]; d90: BestPower[]; d42: BestPower[] }>({
    all: [],
    d90: [],
    d42: [],
  })
  let weeks = $state.raw<WeekZones[]>([])
  let estimate = $state.raw<FtpEstimate | null>(null)
  let loaded = $state(false)
  let rangeDays = $state(90)

  $effect(() => {
    const a = window.cyclotron.analytics
    void Promise.all([
      a.load(),
      a.powerCurve(null),
      a.powerCurve(90),
      a.powerCurve(42),
      a.zonesByWeek(12),
      a.ftpEstimate(),
    ]).then(([l, all, d90, d42, w, e]) => {
      load = l
      curves = { all, d90, d42 }
      weeks = w
      estimate = e
      loaded = true
    })
  })

  const RANGES = [
    { days: 42, label: '6 weeks' },
    { days: 90, label: '3 months' },
    { days: 365, label: '1 year' },
    { days: 0, label: 'All' },
  ]

  const today = $derived(load.at(-1))
  const shown = $derived(rangeDays > 0 ? load.slice(-rangeDays) : load)
  /** Local midnight of a YYYY-MM-DD date, in seconds (uPlot's time unit). */
  const dayS = (date: string): number => {
    const [y, m, d] = date.split('-').map(Number)
    return new Date(y!, m! - 1, d!).getTime() / 1000
  }

  const loadData = $derived<uPlot.AlignedData>([
    shown.map((d) => dayS(d.date)),
    shown.map((d) => d.ctl),
    shown.map((d) => d.atl),
    shown.map((d) => d.tsb),
  ])
  const fmt1 = (_u: uPlot, v: number | null): string => (v == null ? '–' : v.toFixed(0))
  const loadOptions: Omit<uPlot.Options, 'width' | 'height'> = {
    cursor: { sync: { key: 'load' }, drag: { x: false, y: false } },
    axes: [axis(), axis({ label: 'Training load (TSS/day)', size: 60 })],
    series: [
      {},
      line('Fitness (CTL)', series(1), { value: fmt1 }),
      line('Fatigue (ATL)', series(2), { value: fmt1 }),
      line('Form (TSB)', series(3), { value: fmt1 }),
    ],
  }
  const tssData = $derived<uPlot.AlignedData>([
    shown.map((d) => dayS(d.date)),
    shown.map((d) => (d.tss > 0 ? d.tss : null)),
  ])
  const tssOptions: Omit<uPlot.Options, 'width' | 'height'> = {
    cursor: { sync: { key: 'load' }, drag: { x: false, y: false } },
    legend: { show: false },
    axes: [axis(), axis({ label: 'TSS', size: 60 })],
    scales: { y: { range: (_u, _min, max) => [0, Math.max(50, max * 1.1)] } },
    series: [
      {},
      {
        label: 'TSS',
        stroke: series(1),
        fill: series(1),
        points: { show: false },
        paths: uPlot.paths.bars?.({ size: [0.6] }),
      },
    ],
  }

  // Power curve: the three periods share the duration axis.
  const durations = $derived(curves.all.map((p) => p.durationS))
  const at = (list: BestPower[], d: number): number | null =>
    list.find((p) => p.durationS === d)?.watts ?? null
  const curveData = $derived<uPlot.AlignedData>([
    durations,
    durations.map((d) => at(curves.all, d)),
    durations.map((d) => at(curves.d90, d)),
    durations.map((d) => at(curves.d42, d)),
  ])
  const w = (_u: uPlot, v: number | null): string => (v == null ? '–' : `${Math.round(v)} W`)
  const curveOptions: Omit<uPlot.Options, 'width' | 'height'> = {
    scales: {
      x: { time: false, distr: 3, log: 10 },
      y: { range: (_u, _min, max) => [0, max * 1.1] },
    },
    axes: [durationAxis(durationLabel), axis({ label: 'Best power (W)', size: 60 })],
    series: [
      { label: 'Duration', value: (_u, v) => (v == null ? '–' : durationLabel(v)) },
      line('All time', series(1), { value: w }),
      line('Last 90 days', series(2), { value: w }),
      line('Last 6 weeks', series(3), { value: w }),
    ],
  }
  const KEY_DURATIONS = [5, 60, 300, 1200, 3600]

  // Weekly time in zones as three bands: easy Z1–2, moderate Z3–4, hard Z5–7.
  const BANDS = [
    { label: 'Easy (Z1–2)', zones: [0, 1], color: 'var(--series-1)' },
    { label: 'Moderate (Z3–4)', zones: [2, 3], color: 'var(--series-3)' },
    { label: 'Hard (Z5–7)', zones: [4, 5, 6], color: 'var(--series-2)' },
  ]
  const weekBands = $derived(
    weeks.map((wk) => ({
      weekStart: wk.weekStart,
      bands: BANDS.map((b) => b.zones.reduce((s, z) => s + (wk.seconds[z] ?? 0), 0)),
    })),
  )
  const maxWeek = $derived(
    Math.max(3600, ...weekBands.map((wk) => wk.bands.reduce((a, b) => a + b, 0))),
  )
  const hours = (s: number): string => {
    const h = Math.floor(s / 3600)
    const m = Math.round((s % 3600) / 60)
    return h > 0 ? `${h} h ${m} min` : `${m} min`
  }
  const shortDate = (date: string): string =>
    new Date(dayS(date) * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const longDate = (ms: number): string =>
    new Date(ms).toLocaleDateString(undefined, { dateStyle: 'medium' })
</script>

<h1>Progress</h1>

{#if loaded && load.length === 0}
  <p class="muted">
    No rides yet. Ride, or import your past rides from FIT files in History, and your fitness, power
    curve and training zones show up here.
  </p>
{:else if loaded}
  <div class="tiles">
    <Tile label="Fitness (CTL)" value={today ? Math.round(today.ctl) : undefined} />
    <Tile label="Fatigue (ATL)" value={today ? Math.round(today.atl) : undefined} />
    <Tile label="Form (TSB)" value={today ? Math.round(today.tsb) : undefined} />
    <Tile label="FTP" value={profile.ftpW} unit="W" />
  </div>

  {#if estimate}
    <section class="card wide estimate">
      <div>
        <h2>FTP estimate: {estimate.ftpW} W</h2>
        <p class="muted">
          95 % of your best 20 minutes in the last 90 days ({estimate.best20W} W, {estimate.rideName},
          {longDate(estimate.startedAt)}). It's an estimate; an FTP test is more accurate.
        </p>
      </div>
      {#if estimate.ftpW !== profile.ftpW}
        <button onclick={() => profile.setFtp(estimate!.ftpW, 'estimate')}>
          Use {estimate.ftpW} W
        </button>
      {/if}
    </section>
  {/if}

  <section class="card wide">
    <div class="title">
      <h2>Fitness, fatigue and form</h2>
      <div class="ranges" role="group" aria-label="Time range">
        {#each RANGES as r (r.days)}
          <button class:on={rangeDays === r.days} onclick={() => (rangeDays = r.days)}>
            {r.label}
          </button>
        {/each}
      </div>
    </div>
    <p class="muted">
      Fitness is your 6-week training load, fatigue the last week's. Form = fitness − fatigue:
      negative while you're building, positive when you're fresh.
    </p>
    <Chart options={loadOptions} data={loadData} height={240} />
    <h3>Daily training stress</h3>
    <Chart options={tssOptions} data={tssData} height={110} />
  </section>

  <div class="row">
    <section class="card">
      <h2>Power curve</h2>
      {#if durations.length > 0}
        <Chart options={curveOptions} data={curveData} height={260} />
        <table>
          <thead>
            <tr><th class="left">Best</th><th>All time</th><th class="left">Ride</th></tr>
          </thead>
          <tbody>
            {#each KEY_DURATIONS as d (d)}
              {@const best = curves.all.find((p) => p.durationS === d)}
              <tr>
                <td class="left">{durationLabel(d)}</td>
                <td>{best ? `${Math.round(best.watts)} W` : '–'}</td>
                <td class="left muted">
                  {best ? `${best.rideName}, ${longDate(best.startedAt)}` : ''}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="muted">No power data yet.</p>
      {/if}
    </section>

    <section class="card">
      <h2>Time in zones per week</h2>
      <ul class="legend">
        {#each BANDS as b (b.label)}
          <li><span class="swatch" style:background={b.color}></span>{b.label}</li>
        {/each}
      </ul>
      <div class="weeks">
        {#each weekBands as wk, i (wk.weekStart)}
          {@const total = wk.bands.reduce((a, b) => a + b, 0)}
          <div
            class="week"
            title="Week of {shortDate(wk.weekStart)}: {total > 0
              ? BANDS.map((b, i) => `${b.label} ${hours(wk.bands[i]!)}`).join(', ')
              : 'no rides'}"
          >
            <div class="stack">
              {#each BANDS as b, i (b.label)}
                {#if wk.bands[i]! > 0}
                  <span style:height="{(wk.bands[i]! / maxWeek) * 100}%" style:background={b.color}
                  ></span>
                {/if}
              {/each}
            </div>
            <!-- Every other week, ending on the current one, so labels don't collide. -->
            <span class="week-label">
              {(weekBands.length - 1 - i) % 2 === 0 ? shortDate(wk.weekStart) : ''}
            </span>
          </div>
        {/each}
      </div>
      <p class="muted">
        Most training should be easy, with a smaller share of hard work. Hover a week for its hours.
      </p>
    </section>
  </div>
{/if}

<style>
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(clamp(12rem, 10vw, 22rem), 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .wide {
    max-width: none;
  }
  .estimate {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .estimate button {
    white-space: nowrap;
  }
  .estimate h2,
  .estimate p {
    margin: 0 0 0.25rem;
  }
  .title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .ranges {
    display: flex;
    gap: 0.25rem;
  }
  .ranges button.on {
    background: var(--z2);
    color: var(--bg);
  }
  h3 {
    font-size: 0.9rem;
    margin: 1rem 0 0.25rem;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(28rem, 1fr));
    gap: 1rem;
  }
  .row .card {
    max-width: none;
    margin: 0;
  }
  table {
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
    margin-top: 0.75rem;
  }
  th,
  td {
    padding: 0.25rem 0.75rem;
    text-align: right;
  }
  th {
    color: var(--muted);
    font-weight: normal;
  }
  .left {
    text-align: left;
  }
  .legend {
    list-style: none;
    display: flex;
    gap: 1rem;
    padding: 0;
    margin: 0 0 0.75rem;
    font-size: 0.85rem;
  }
  .swatch {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 3px;
    margin-right: 0.35rem;
    vertical-align: -1px;
  }
  .weeks {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 0.5rem;
    height: 14rem;
  }
  .week {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .stack {
    flex: 1;
    display: flex;
    flex-direction: column-reverse;
    gap: 2px;
  }
  .stack span {
    display: block;
    width: 100%;
  }
  /* Only the top of each bar is rounded (column-reverse: the last child is on top). */
  .stack span:last-child {
    border-radius: 4px 4px 0 0;
  }
  .week-label {
    font-size: 0.7rem;
    color: var(--muted);
    text-align: center;
    margin-top: 0.25rem;
    white-space: nowrap;
    min-height: 1em;
  }
</style>
