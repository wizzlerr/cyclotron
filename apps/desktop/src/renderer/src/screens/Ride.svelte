<script lang="ts">
  import PadHint from '../components/PadHint.svelte'
  import { padmap } from '../lib/padmap.svelte'
  import { padnav } from '../lib/padnav.svelte'
  import { controls, ERG_STEP_W, RESISTANCE_STEP } from '../ride/controls.svelte'
  import { caloriesKcal, heartRateZone, powerZone } from '@cyclotron/core'
  import LiveChart from '../components/LiveChart.svelte'
  import RideSummary from '../components/RideSummary.svelte'
  import RouteMap from '../components/RouteMap.svelte'
  import RouteProfile from '../components/RouteProfile.svelte'
  import Tile from '../components/Tile.svelte'
  import type { ComponentProps } from 'svelte'
  import WorldView from '../components/WorldView.svelte'
  import WorkoutProfile from '../components/WorkoutProfile.svelte'
  import { devices } from '../devices/devices.svelte'
  import { workoutName } from '../i18n/content'
  import { formatNumber } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { balancedColumns, columnsWithWide, shareSpace, type Elastic } from '../lib/fit'
  import { describeSegment as describe, formatDuration, formatKm } from '../lib/format'
  import { go } from '../nav.svelte'
  import { profile } from '../profile.svelte'
  import { ride } from '../ride/session.svelte'
  import { rideTiles, type TileId } from '../ride/tiles.svelte'
  import { worldPrefs } from '../world/prefs.svelte'

  // The ride screen fits the window, since nobody scrolls from the bike: tiles and controls take
  // what they need and the charts share the rest (fit() below). Only when even their minimum
  // sizes don't fit (a small window with the 3D world on) does the page scroll.
  let pageEl: HTMLDivElement | undefined = $state()
  let windowWidth = $state(1280)
  let tilesWidth = $state(1000)
  let profileHeight = $state(110)
  let routeHeight = $state(110)
  let chartHeight = $state(200)
  let worldHeight = $state(300)
  const s = $derived(ride.state)
  const remaining = $derived(s ? Math.ceil(s.segmentRemainingS) : 0)
  const pZone = $derived(
    devices.power3s && devices.power3s > 0 ? powerZone(devices.power3s, profile.ftpW) : undefined,
  )
  const hrZone = $derived(
    devices.bpm && profile.maxHr ? heartRateZone(devices.bpm, profile.maxHr) : undefined,
  )
  const manualErgOn = $derived(controls.manualErgOn)

  // Zwift controller buttons navigation didn't use (lib/padnav.svelte.ts), run as the action
  // they're mapped to (Settings → Controllers).
  $effect(() => padnav.unhandled.on((button) => controls.run(padmap.action(button))))

  type TileProps = ComponentProps<typeof Tile>

  const fixed = (n: number | undefined, digits: number): string | undefined =>
    n === undefined ? undefined : formatNumber(n, digits)

  /** Props for every tile (E4-1…E4-3); the layout setting picks which are shown (E4-5). */
  const tiles = $derived.by((): Record<TileId, TileProps> => {
    const m = ride.metrics
    const L = t().ride.tiles
    const target = ride.active ? ride.targetW : manualErgOn ? controls.ergWatts : undefined
    const powerLabel = pZone ? t().ride.powerZoneTile(pZone) : L.power3s.short
    const intervalHot = s?.status === 'running' && remaining <= 5 && s.next !== undefined
    const timed = s !== undefined && !ride.isFreeRide
    return {
      powerTarget: {
        label: powerLabel,
        parts:
          target === undefined
            ? undefined
            : [
                { value: devices.power3s, name: powerLabel },
                { value: target, color: 'var(--muted)', name: L.target.short },
              ],
        value: devices.power3s,
        sep: '/',
        unit: 'W',
        accent: pZone ? `var(--z${pZone})` : undefined,
      },
      avgNp: {
        label: L.avgNp.short,
        parts: [
          { value: m?.avgPowerW, name: L.avgPower.short },
          { value: m?.normalizedPowerW, name: L.np.short },
        ],
        unit: 'W',
      },
      time: {
        label: L.elapsed.short,
        parts: timed
          ? [
              {
                value: formatDuration(remaining),
                color: intervalHot ? 'var(--warn)' : 'var(--series-1)',
                name: L.time.interval,
              },
              { value: formatDuration(s.positionS), name: L.elapsed.short },
              {
                value: formatDuration(s.totalS),
                color: 'var(--muted)',
                name: L.time.total,
              },
            ]
          : undefined,
        value: s ? formatDuration(s.positionS) : undefined,
      },
      power3s: {
        label: pZone ? t().ride.powerZoneTile(pZone) : L.power3s.short,
        value: devices.power3s,
        unit: 'W',
        accent: pZone ? `var(--z${pZone})` : undefined,
      },
      power: { label: L.power.short, value: devices.data?.powerW, unit: 'W' },
      power10s: { label: L.power10s.short, value: devices.power10s, unit: 'W' },
      target: { label: L.target.short, value: target, unit: 'W' },
      intervalLeft: {
        label: L.intervalLeft.short,
        value: s ? formatDuration(remaining) : undefined,
        highlight: s?.status === 'running' && remaining <= 5 && s.next !== undefined,
      },
      intervalAvg: { label: L.intervalAvg.short, value: ride.intervalAvgW, unit: 'W' },
      elapsed: {
        label: L.elapsed.short,
        value: s ? formatDuration(s.positionS) : undefined,
        unit: s && !ride.isFreeRide ? `/ ${formatDuration(s.totalS)}` : '',
      },
      hr: {
        label: hrZone ? t().ride.hrZoneTile(hrZone) : L.hr.short,
        value: devices.bpm,
        unit: 'bpm',
        accent: hrZone ? `var(--z${hrZone})` : undefined,
      },
      cadence: { label: L.cadence.short, value: devices.data?.cadenceRpm, unit: 'rpm' },
      speed: {
        label: L.speed.short,
        value: ride.routeState ? fixed(ride.routeState.speedKmh, 1) : devices.data?.speedKmh,
        unit: 'km/h',
      },
      wkg: {
        label: profile.weightKg ? L.wkg.short : t().ride.wkgSetWeight,
        value: profile.weightKg ? fixed((devices.power3s ?? 0) / profile.weightKg, 1) : undefined,
      },
      avgPower: { label: L.avgPower.short, value: m?.avgPowerW, unit: 'W' },
      np: { label: L.np.short, value: m?.normalizedPowerW, unit: 'W' },
      if: { label: L.if.short, value: fixed(m?.intensity, 2) },
      tss: { label: L.tss.short, value: m?.tss },
      kcal: { label: L.kcal.short, value: m && caloriesKcal(m.workKj), unit: 'kcal' },
    }
  })

  const RIDE_METRICS = new Set<TileId>([
    'avgPower',
    'np',
    'if',
    'tss',
    'kcal',
    'elapsed',
    'intervalAvg',
    'avgNp',
    'time',
  ])
  /** Before a ride: only live readings; ride totals and interval tiles have nothing to show. */
  const shownIds = $derived(
    rideTiles.shown.filter((id) => {
      if (!ride.workout) return !RIDE_METRICS.has(id) && id !== 'intervalLeft'
      return !(ride.isFreeRide && (id === 'intervalLeft' || id === 'intervalAvg'))
    }),
  )

  const rem = (): number => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  /** Wider tiles on big windows, to fit the bigger numbers (Tile.svelte); rows come out even. */
  const tileLayout = $derived.by(() => {
    void windowWidth
    const r = rem()
    const minTile = Math.min(22 * r, Math.max(10 * r, windowWidth * 0.1))
    const gap = 0.75 * r
    // The time tile holds three times, so it spans two columns when there are three or more.
    if (shownIds.includes('time') && !ride.isFreeRide) {
      return columnsWithWide(shownIds.length, tilesWidth, minTile, gap)
    }
    return { columns: balancedColumns(shownIds.length, tilesWidth, minTile, gap), span: 1 }
  })

  type Part = 'profile' | 'route' | 'chart' | 'world'
  const setters: Record<Part, (px: number) => void> = {
    profile: (px) => (profileHeight = px),
    route: (px) => (routeHeight = px),
    chart: (px) => (chartHeight = px),
    world: (px) => (worldHeight = px),
  }

  /**
   * Sizes the charts so the page is exactly as tall as the window. Everything that isn't a chart
   * keeps its height, so "fixed" = page height − current chart heights, and the charts share
   * window − fixed. Re-runs whenever the page or the window changes size.
   */
  function fit(): void {
    const page = pageEl
    const main = page?.parentElement
    const st = ride.state
    if (!page || !main || !st || st.status === 'finished') return
    const cs = getComputedStyle(main)
    const room = main.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
    const r = rem()
    const parts: { part: Part; now: number; spec: Elastic }[] = []
    if (!ride.isFreeRide) {
      parts.push({ part: 'profile', now: profileHeight, spec: { weight: 2, min: 60, max: 20 * r } })
    }
    if (ride.route && ride.routeState) {
      parts.push({ part: 'route', now: routeHeight, spec: { weight: 2, min: 70, max: 20 * r } })
    }
    if (st.status !== 'ready') {
      parts.push({ part: 'chart', now: chartHeight, spec: { weight: 3, min: 120 } })
    }
    const world = page.querySelector<HTMLElement>('.world')
    if (worldPrefs.enabled && world) {
      // The world keeps its wide shape (WorldView.svelte), so it never gets taller than that.
      const max = Math.max(200, world.clientWidth / 2.35)
      parts.push({ part: 'world', now: world.offsetHeight, spec: { weight: 5, min: 200, max } })
    }
    if (parts.length === 0) return
    const fixed = page.offsetHeight - parts.reduce((a, p) => a + p.now, 0)
    const sizes = shareSpace(
      room - fixed,
      parts.map((p) => p.spec),
    )
    parts.forEach((p, i) => {
      const size = sizes[i] ?? p.now
      if (Math.abs(size - p.now) > 1) setters[p.part](size)
    })
  }

  $effect(() => {
    const page = pageEl
    if (!page?.parentElement) return
    const observer = new ResizeObserver(() => fit())
    observer.observe(page)
    observer.observe(page.parentElement)
    return () => observer.disconnect()
  })
</script>

<svelte:window bind:innerWidth={windowWidth} />

{#snippet ergControls()}
  {#if manualErgOn}
    <button onclick={() => controls.setErg(controls.ergWatts - ERG_STEP_W)}
      >−{ERG_STEP_W} W<PadHint action="minus" /></button
    >
    <span class="erg">ERG {controls.ergWatts} W</span>
    <button onclick={() => controls.setErg(controls.ergWatts + ERG_STEP_W)}
      >+{ERG_STEP_W} W<PadHint action="plus" /></button
    >
    <button onclick={() => controls.ergOff()}>{t().ride.ergOff}<PadHint action="erg" /></button>
  {:else if controls.manualResistanceOn}
    <button onclick={() => controls.setResistance(controls.resistancePct - RESISTANCE_STEP)}
      >−{RESISTANCE_STEP} %<PadHint action="minus" /></button
    >
    <span class="erg">{t().ride.resistance(controls.resistancePct)}</span>
    <button onclick={() => controls.setResistance(controls.resistancePct + RESISTANCE_STEP)}
      >+{RESISTANCE_STEP} %<PadHint action="plus" /></button
    >
    <button onclick={() => controls.ergOff()}>{t().ride.resistanceOff}</button>
  {:else}
    <button onclick={() => controls.setErg(controls.ergWatts)}
      >{t().ride.ergMode}<PadHint action="erg" /></button
    >
    {#if controls.canResistance}
      <button onclick={() => controls.setResistance(controls.resistancePct)}
        >{t().ride.resistanceMode}</button
      >
    {/if}
  {/if}
{/snippet}

{#snippet tileGrid()}
  <div
    class="tiles"
    bind:clientWidth={tilesWidth}
    style:grid-template-columns="repeat({tileLayout.columns}, minmax(0, 1fr))"
  >
    {#each shownIds as id (id)}
      <div
        class="cell"
        style:grid-column={id === 'time' && tileLayout.span > 1
          ? `span ${tileLayout.span}`
          : undefined}
      >
        <Tile {...tiles[id]} />
      </div>
    {/each}
  </div>
{/snippet}

{#snippet deviceWarnings()}
  {#if !devices.trainer}
    <p class="warn">
      {t().ride.noTrainer}
      <button onclick={() => go('settings', 'devices')}>{t().ride.devices}</button>
    </p>
  {:else if devices.trainerStatus === 'reconnecting'}
    <p class="warn">{t().ride.reconnecting}</p>
  {:else if !devices.trainer.capabilities().erg}
    <p class="muted">{t().ride.readOnlyTrainer}</p>
  {/if}
{/snippet}

{#if ride.workout && ride.player && s}
  <div class="ride-page" bind:this={pageEl}>
    <div class="head">
      <h1>{workoutName(ride.workout)}</h1>
      {#if !ride.isFreeRide}<span class="muted">{describe(s.segment)}</span>{/if}
    </div>

    {#if s.status === 'finished'}
      {#if ride.saving}
        <p class="muted">{t().ride.saving}</p>
      {:else if ride.result}
        <RideSummary
          result={ride.result}
          onclose={() => ride.close()}
          ondiscard={() => ride.discard()}
        />
      {:else}
        <p class="muted">{t().ride.nothingRecorded}</p>
        <button onclick={() => ride.close()}>{t().common.actions.close}</button>
      {/if}
    {:else}
      {@render deviceWarnings()}

      {@render tileGrid()}

      {#if worldPrefs.enabled}
        {#key ride.route?.id}<WorldView maxHeight={worldHeight} />{/key}
      {/if}

      {#if ride.route && ride.routeState}
        {@const r = ride.routeState}
        {@const grade = r.position.gradePct}
        <div class="card route">
          <dl class="route-stats">
            <div class="grade">
              <dt>{t().ride.route.grade}</dt>
              <dd>{formatNumber(grade, 1)} %</dd>
            </div>
            <div>
              <dt>{t().ride.route.speed}</dt>
              <dd>{formatNumber(r.speedKmh, 1)} km/h</dd>
            </div>
            <div>
              <dt>{t().ride.route.distance}</dt>
              <dd>{formatKm(r.distanceM)}</dd>
            </div>
            <div>
              <dt>{t().ride.route.toGo}</dt>
              <dd>{formatKm(r.remainingM)}</dd>
            </div>
            <div>
              <dt>{t().ride.route.elevation}</dt>
              <dd>{Math.round(r.position.ele)} m</dd>
            </div>
            <div>
              <dt>{t().ride.route.climbed}</dt>
              <dd>{Math.round(r.climbedM)} m</dd>
            </div>
          </dl>
          <div class="route-view">
            <div class="route-profile">
              <RouteProfile route={ride.route} positionM={r.position.d} height={routeHeight} axes />
            </div>
            <RouteMap route={ride.route} position={r.position} size={routeHeight} />
          </div>
          {#if ride.isFreeRide}
            <p class="muted next">
              {t().ride.route.trainerDifficulty(
                Math.round(profile.difficulty * 100),
                formatNumber(grade * profile.difficulty, 1),
              )}
            </p>
          {/if}
        </div>
      {/if}

      {#if !ride.isFreeRide}
        <div class="profile card">
          <WorkoutProfile
            timeline={ride.player.timeline}
            positionS={s.positionS}
            ftpW={ride.player.ftpW * s.intensity}
            height={profileHeight}
            axes
          />
          {#if s.next}
            <p class="muted next">
              {t().ride.nextIn(formatDuration(remaining), describe(s.next))}{s.nextTargetW
                ? ` · ${s.nextTargetW} W`
                : ''}
            </p>
          {/if}
        </div>
      {/if}

      {#if s.status !== 'ready'}
        <div class="card chart"><LiveChart height={chartHeight} /></div>
      {/if}
    {/if}

    {#if ride.notice && s.status !== 'finished'}<p class="warn">{ride.notice()}</p>{/if}
    {#if ride.error}<p class="error">{ride.error()}</p>{/if}
    {#if devices.error}<p class="error">{devices.error}</p>{/if}
  </div>
{:else}
  <h1>{t().ride.title}</h1>

  {#if !devices.trainer}
    <p class="muted">{t().ride.noTrainer}</p>
    <button onclick={() => go('settings', 'devices')}>{t().ride.devices}</button>
  {:else}
    {@render deviceWarnings()}
    {@render tileGrid()}

    <section class="controls">
      <button class="primary" onclick={() => ride.startFreeRide()}>{t().ride.startFreeRide}</button>
      <button onclick={() => go('workouts')}>{t().ride.chooseWorkout}</button>
      <span class="sep"></span>
      {@render ergControls()}
    </section>
    <p class="muted">{t().ride.notRecordedYet}</p>
    {#if devices.error}<p class="error">{devices.error}</p>{/if}
  {/if}
{/if}

<style>
  .head {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .head h1 {
    margin: 0;
  }
  .tiles {
    display: grid;
    grid-auto-flow: row dense;
    gap: 0.75rem;
  }
  .cell {
    display: grid;
    min-width: 0;
  }
  .chart {
    margin-top: 0.75rem;
    max-width: none;
  }
  .profile {
    margin-top: 0.75rem;
    max-width: none;
  }
  .next {
    margin: 0.5rem 0 0;
  }
  .route {
    margin-top: 0.75rem;
    max-width: none;
  }
  .route-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 2rem;
    margin: 0 0 0.75rem;
  }
  .route-stats dt {
    font-size: 0.75rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .route-stats dd {
    margin: 0;
    font-size: 1.25rem;
    font-variant-numeric: tabular-nums;
  }
  .route-stats .grade dd {
    font-size: 1.75rem;
    font-weight: 600;
  }
  .route-view {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }
  .route-profile {
    flex: 1;
    min-width: 0;
  }
  .controls {
    margin-top: 1rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .sep {
    width: 1rem;
  }
  .primary {
    font-weight: 600;
  }
  .warn {
    color: var(--warn);
  }
  .error {
    color: var(--error);
  }
  .erg {
    min-width: 7rem;
    text-align: center;
    font-weight: 600;
  }
  /* A column with even gaps, so its height is the sum of its parts (fit()). Last, so it wins
     over the margins above. */
  .ride-page {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .ride-page > :global(*) {
    margin-top: 0;
    margin-bottom: 0;
  }
</style>
