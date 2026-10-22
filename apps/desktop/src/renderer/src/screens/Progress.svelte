<script lang="ts">
  // E9-2…E9-4, E9-6: power curve, fitness/fatigue/form, weekly time in zones, FTP estimate.
  // Everything is computed on this computer from local rides (D19).
  import uPlot from 'uplot'
  import type { BestPower, DailyLoad, FtpEstimate, WeekZones } from '../../../shared/api'
  import Chart from '../components/Chart.svelte'
  import Tile from '../components/Tile.svelte'
  import { formatDate } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { axis, dateAxis, durationAxis, line, series } from '../lib/chart'
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
    { days: 42, key: 'd42' },
    { days: 90, key: 'd90' },
    { days: 365, key: 'd365' },
    { days: 0, key: 'all' },
  ] as const

  const today = $derived(load.at(-1))
  const shown = $derived(rangeDays > 0 ? load.slice(-rangeDays) : load)
  /** Local midnight of a YYYY-MM-DD date, in seconds (uPlot's time unit). */
  const dayS = (date: string): number => {
    const [y, m, d] = date.split('-').map(Number)
    return new Date(y!, m! - 1, d!).getTime() / 1000
  }

  // Chart options are derived from t(), so the charts rebuild when the language changes.
  type Options = Omit<uPlot.Options, 'width' | 'height'>
  const dayValue = (_u: uPlot, v: number | null): string =>
    v == null ? '–' : formatDate(v * 1000, { dateStyle: 'medium' })

  const loadData = $derived<uPlot.AlignedData>([
    shown.map((d) => dayS(d.date)),
    shown.map((d) => d.ctl),
    shown.map((d) => d.atl),
    shown.map((d) => d.tsb),
  ])
  const fmt1 = (_u: uPlot, v: number | null): string => (v == null ? '–' : String(Math.round(v)))
  const loadOptions = $derived<Options>({
    cursor: { sync: { key: 'load' }, drag: { x: false, y: false } },
    axes: [dateAxis(), axis({ label: t().history.progress.loadAxis, size: 60 })],
    series: [
      { label: t().history.history.cols.date, value: dayValue },
      line(t().history.progress.fitness, series(1), { value: fmt1 }),
      line(t().history.progress.fatigue, series(2), { value: fmt1 }),
      line(t().history.progress.form, series(3), { value: fmt1 }),
    ],
  })
  const tssData = $derived<uPlot.AlignedData>([
    shown.map((d) => dayS(d.date)),
    shown.map((d) => (d.tss > 0 ? d.tss : null)),
  ])
  const tssOptions = $derived<Options>({
    cursor: { sync: { key: 'load' }, drag: { x: false, y: false } },
    legend: { show: false },
    axes: [dateAxis(), axis({ label: 'TSS', size: 60 })],
    scales: { y: { range: (_u, _min, max) => [0, Math.max(50, max * 1.1)] } },
    series: [
      { label: t().history.history.cols.date, value: dayValue },
      {
        label: 'TSS',
        stroke: series(1),
        fill: series(1),
        points: { show: false },
        paths: uPlot.paths.bars?.({ size: [0.6] }),
      },
    ],
  })

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
  const curveOptions = $derived<Options>({
    scales: {
      x: { time: false, distr: 3, log: 10 },
      y: { range: (_u, _min, max) => [0, max * 1.1] },
    },
    axes: [
      durationAxis(durationLabel, t().history.charts.duration),
      axis({ label: t().history.charts.bestPowerAxis, size: 60 }),
    ],
    series: [
      {
        label: t().history.charts.duration,
        value: (_u, v) => (v == null ? '–' : durationLabel(v)),
      },
      line(t().history.progress.allTime, series(1), { value: w }),
      line(t().history.progress.last90, series(2), { value: w }),
      line(t().history.progress.last6w, series(3), { value: w }),
    ],
  })
  const KEY_DURATIONS = [5, 60, 300, 1200, 3600]

  // Weekly time in zones as three bands: easy Z1–2, moderate Z3–4, hard Z5–7.
  type Band = 'easy' | 'moderate' | 'hard'
  const BANDS: { key: Band; zones: number[]; color: string }[] = [
    { key: 'easy', zones: [0, 1], color: 'var(--series-1)' },
    { key: 'moderate', zones: [2, 3], color: 'var(--series-3)' },
    { key: 'hard', zones: [4, 5, 6], color: 'var(--series-2)' },
  ]
  const bandLabel = (key: Band): string => t().history.progress.bands[key]
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
    formatDate(dayS(date) * 1000, { day: 'numeric', month: 'short' })
  const longDate = (ms: number): string => formatDate(ms, { dateStyle: 'medium' })
</script>

<h1>{t().history.progress.title}</h1>

{#if loaded && load.length === 0}
  <p class="muted">{t().history.progress.empty}</p>
{:else if loaded}
  <div class="tiles">
    <Tile label={t().history.progress.fitness} value={today ? Math.round(today.ctl) : undefined} />
    <Tile label={t().history.progress.fatigue} value={today ? Math.round(today.atl) : undefined} />
    <Tile label={t().history.progress.form} value={today ? Math.round(today.tsb) : undefined} />
    <Tile label="FTP" value={profile.ftpW} unit="W" />
  </div>

  {#if estimate}
    <section class="card wide estimate">
      <div>
        <h2>{t().history.progress.estimateTitle(estimate.ftpW)}</h2>
        <p class="muted">
          {t().history.progress.estimateText(
            String(estimate.best20W),
            estimate.rideName,
            longDate(estimate.startedAt),
          )}
        </p>
      </div>
      {#if estimate.ftpW !== profile.ftpW}
        <button onclick={() => profile.setFtp(estimate!.ftpW, 'estimate')}>
          {t().history.progress.useFtp(estimate.ftpW)}
        </button>
      {/if}
    </section>
  {/if}

  <section class="card wide">
    <div class="title">
      <h2>{t().history.progress.loadTitle}</h2>
      <div class="ranges" role="group" aria-label={t().history.progress.timeRange}>
        {#each RANGES as r (r.days)}
          <button class:on={rangeDays === r.days} onclick={() => (rangeDays = r.days)}>
            {t().history.progress.ranges[r.key]}
          </button>
        {/each}
      </div>
    </div>
    <p class="muted">{t().history.progress.loadText}</p>
    <Chart options={loadOptions} data={loadData} height={240} />
    <h3>{t().history.progress.dailyStress}</h3>
    <Chart options={tssOptions} data={tssData} height={110} />
  </section>

  <div class="row">
    <section class="card">
      <h2>{t().history.progress.powerCurve}</h2>
      {#if durations.length > 0}
        <Chart options={curveOptions} data={curveData} height={260} />
        <table>
          <thead>
            <tr>
              <th class="left">{t().history.progress.best}</th>
              <th>{t().history.progress.allTime}</th>
              <th class="left">{t().history.progress.ride}</th>
            </tr>
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
        <p class="muted">{t().history.progress.noPower}</p>
      {/if}
    </section>

    <section class="card">
      <h2>{t().history.progress.zonesTitle}</h2>
      <ul class="legend">
        {#each BANDS as b (b.key)}
          <li><span class="swatch" style:background={b.color}></span>{bandLabel(b.key)}</li>
        {/each}
      </ul>
      <div class="weeks">
        {#each weekBands as wk, i (wk.weekStart)}
          {@const total = wk.bands.reduce((a, b) => a + b, 0)}
          <div
            class="week"
            title={t().history.progress.weekOf(
              shortDate(wk.weekStart),
              total > 0
                ? BANDS.map((b, i) => `${bandLabel(b.key)} ${hours(wk.bands[i]!)}`).join(', ')
                : t().history.progress.noRides,
            )}
          >
            <div class="stack">
              {#each BANDS as b, i (b.key)}
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
      <p class="muted">{t().history.progress.zonesText}</p>
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
