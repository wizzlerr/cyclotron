<script lang="ts">
  import PadHint from '../components/PadHint.svelte'
  import { padnav } from '../lib/padnav.svelte'
  import { buttonDirection, caloriesKcal, heartRateZone, powerZone } from '@cyclotron/core'
  import LiveChart from '../components/LiveChart.svelte'
  import RideSummary from '../components/RideSummary.svelte'
  import RouteMap from '../components/RouteMap.svelte'
  import RouteProfile from '../components/RouteProfile.svelte'
  import Tile from '../components/Tile.svelte'
  import WorldView from '../components/WorldView.svelte'
  import WorkoutProfile from '../components/WorkoutProfile.svelte'
  import { devices } from '../devices/devices.svelte'
  import { workoutName } from '../i18n/content'
  import { formatNumber } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { balancedColumns, shareSpace, type Elastic } from '../lib/fit'
  import { describeSegment as describe, formatDuration, formatKm, formatPct } from '../lib/format'
  import { go } from '../nav.svelte'
  import { profile } from '../profile.svelte'
  import { ride } from '../ride/session.svelte'
  import { rideTiles, type TileId } from '../ride/tiles.svelte'
  import { worldPrefs } from '../world/prefs.svelte'

  const STEP_W = 10

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
  let ergWatts = $state(150)
  /** Manual resistance (E2-3), 0–100 % of the trainer's range. */
  let resistancePct = $state(30)
  const RESISTANCE_STEP = 5
  let confirmEnd = $state(false)

  const s = $derived(ride.state)
  const remaining = $derived(s ? Math.ceil(s.segmentRemainingS) : 0)
  const inFreeStep = $derived(s?.status === 'running' && s.segment?.kind === 'freeride')
  const pZone = $derived(
    devices.power3s && devices.power3s > 0 ? powerZone(devices.power3s, profile.ftpW) : undefined,
  )
  const hrZone = $derived(
    devices.bpm && profile.maxHr ? heartRateZone(devices.bpm, profile.maxHr) : undefined,
  )
  // Manual ERG: before a ride it drives the trainer directly; during a free-ride step it goes
  // through the session so it's recorded and survives pause/resume.
  const manualErgOn = $derived(
    ride.active ? ride.manual?.kind === 'erg' : devices.control.kind === 'erg',
  )

  function setErg(watts: number): void {
    ergWatts = Math.min(1000, Math.max(50, watts))
    const control = { kind: 'erg', watts: ergWatts } as const
    if (ride.active) ride.setManual(control)
    else void devices.setControl(control)
  }

  function ergOff(): void {
    if (ride.active) ride.setManual(undefined)
    else void devices.setControl({ kind: 'free' })
  }

  const manualResistanceOn = $derived(
    ride.active ? ride.manual?.kind === 'resistance' : devices.control.kind === 'resistance',
  )
  const canResistance = $derived(devices.trainer?.capabilities().resistance ?? false)

  function setResistance(pct: number): void {
    resistancePct = Math.min(100, Math.max(0, pct))
    const control = { kind: 'resistance', level: resistancePct } as const
    if (ride.active) ride.setManual(control)
    else void devices.setControl(control)
  }

  // Zwift controller buttons navigation didn't use (lib/padnav.svelte.ts, Settings → Controllers).
  $effect(() =>
    padnav.unhandled.on((button) => {
      const dir = buttonDirection(button)
      const st = ride.state?.status
      if (dir !== 0) {
        if (manualErgOn) setErg(ergWatts + dir * STEP_W)
        else if (manualResistanceOn) setResistance(resistancePct + dir * RESISTANCE_STEP)
        else if (ride.active && !inFreeStep) ride.adjustIntensity(dir * 0.01)
        // Free riding: + / − switch ERG on, a step up or down from the last target.
        else setErg(ergWatts + dir * STEP_W)
        return
      }
      if (button === 'a') {
        if (st === 'ready' && devices.trainer) ride.start()
        else if (st === 'running') ride.pause()
        else if (st === 'paused') ride.resume()
      } else if (button === 'b') {
        if (manualErgOn) ergOff()
        else if (!ride.active || inFreeStep) setErg(ergWatts)
      } else if (button === 'y') {
        ride.muted = !ride.muted
      } else if (button === 'z') {
        worldPrefs.setEnabled(!worldPrefs.enabled)
      }
    }),
  )

  function end(): void {
    confirmEnd = false
    ride.end()
  }

  interface TileProps {
    label: string
    value: number | string | undefined
    unit?: string
    accent?: string
    highlight?: boolean
  }

  const fixed = (n: number | undefined, digits: number): string | undefined =>
    n === undefined ? undefined : formatNumber(n, digits)

  /** Props for every tile (E4-1…E4-3); the layout setting picks which are shown (E4-5). */
  const tiles = $derived.by((): Record<TileId, TileProps> => {
    const m = ride.metrics
    const L = t().ride.tiles
    const target = ride.active ? ride.targetW : manualErgOn ? ergWatts : undefined
    return {
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
  const tileColumns = $derived.by(() => {
    void windowWidth
    const r = rem()
    const minTile = Math.min(22 * r, Math.max(10 * r, windowWidth * 0.1))
    return balancedColumns(shownIds.length, tilesWidth, minTile, 0.75 * r)
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
    <button onclick={() => setErg(ergWatts - STEP_W)}>−{STEP_W} W<PadHint button="minus" /></button>
    <span class="erg">ERG {ergWatts} W</span>
    <button onclick={() => setErg(ergWatts + STEP_W)}>+{STEP_W} W<PadHint button="plus" /></button>
    <button onclick={ergOff}
      >{t().ride.ergOff}{#if inFreeStep || !ride.active}<PadHint button="b" />{/if}</button
    >
  {:else if manualResistanceOn}
    <button onclick={() => setResistance(resistancePct - RESISTANCE_STEP)}
      >−{RESISTANCE_STEP} %<PadHint button="minus" /></button
    >
    <span class="erg">{t().ride.resistance(resistancePct)}</span>
    <button onclick={() => setResistance(resistancePct + RESISTANCE_STEP)}
      >+{RESISTANCE_STEP} %<PadHint button="plus" /></button
    >
    <button onclick={ergOff}>{t().ride.resistanceOff}</button>
  {:else}
    <button onclick={() => setErg(ergWatts)}
      >{t().ride.ergMode}{#if inFreeStep || !ride.active}<PadHint button="b" />{/if}</button
    >
    {#if canResistance}
      <button onclick={() => setResistance(resistancePct)}>{t().ride.resistanceMode}</button>
    {/if}
  {/if}
{/snippet}

{#snippet tileGrid()}
  <div
    class="tiles"
    bind:clientWidth={tilesWidth}
    style:grid-template-columns="repeat({tileColumns}, minmax(0, 1fr))"
  >
    {#each shownIds as id (id)}
      <Tile {...tiles[id]} />
    {/each}
  </div>
{/snippet}

{#snippet deviceWarnings()}
  {#if !devices.trainer}
    <p class="warn">
      {t().ride.noTrainer} <button onclick={() => go('settings')}>{t().ride.devices}</button>
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

      <section class="controls">
        {#if s.status === 'ready'}
          <button class="primary" onclick={() => ride.start()} disabled={!devices.trainer}>
            {t().common.actions.start}<PadHint button="a" />
          </button>
          <button onclick={() => ride.close()}>{t().common.actions.close}</button>
        {:else}
          {#if s.status === 'running'}
            <button onclick={() => ride.pause()}
              >{t().common.actions.pause}<PadHint button="a" /></button
            >
          {:else}
            <button class="primary" onclick={() => ride.resume()}
              >{t().common.actions.resume}<PadHint button="a" /></button
            >
          {/if}
          {#if !ride.isFreeRide}<button onclick={() => ride.skip()}>{t().ride.skipStep}</button
            >{/if}
          {#if confirmEnd}
            <span class="warn">{t().ride.confirmEnd}</span>
            <button class="primary" onclick={end}>{t().common.actions.end}</button>
            <button onclick={() => (confirmEnd = false)}>{t().common.actions.cancel}</button>
          {:else}
            <button onclick={() => (confirmEnd = true)}>{t().ride.endEllipsis}</button>
          {/if}

          {#if !ride.isFreeRide}
            <span class="sep"></span>
            <button onclick={() => ride.adjustIntensity(-0.05)}>−5</button>
            <button onclick={() => ride.adjustIntensity(-0.01)}>−1<PadHint button="minus" /></button
            >
            <button
              class="intensity"
              onclick={() => ride.resetIntensity()}
              title={t().ride.resetIntensity}
            >
              {formatPct(s.intensity)}
            </button>
            <button onclick={() => ride.adjustIntensity(0.01)}>+1<PadHint button="plus" /></button>
            <button onclick={() => ride.adjustIntensity(0.05)}>+5</button>
          {/if}
        {/if}
        <button
          class="world-toggle"
          class:on={worldPrefs.enabled}
          aria-pressed={worldPrefs.enabled}
          title={worldPrefs.enabled ? t().world.toggleOn : t().world.toggleOff}
          onclick={() => worldPrefs.setEnabled(!worldPrefs.enabled)}
          >{t().world.toggle}<PadHint button="z" /></button
        >
        <label class="mute"
          ><input type="checkbox" bind:checked={ride.muted} />
          {t().ride.mute}<PadHint button="y" /></label
        >
      </section>

      {#if worldPrefs.enabled}
        {#key ride.route?.id}<WorldView maxHeight={worldHeight} />{/key}
      {/if}

      {#if inFreeStep}
        <section class="controls">{@render ergControls()}</section>
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
    <button onclick={() => go('settings')}>{t().ride.devices}</button>
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
  .world-toggle {
    margin-left: auto;
  }
  .world-toggle.on {
    outline: 2px solid var(--series-1);
  }
  .world-toggle + .mute {
    margin-left: 0.5rem;
  }
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
    gap: 0.75rem;
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
  .intensity {
    min-width: 4.5rem;
    font-weight: 600;
  }
  .primary {
    font-weight: 600;
  }
  .mute {
    margin-left: auto;
    color: var(--muted);
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
