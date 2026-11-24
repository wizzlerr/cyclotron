<script lang="ts">
  // The Ride screen tiles, laid out by the rider (E4-6): tiles placed on a 12-column grid, each
  // showing any number of values in its own size, colours, alignment and animation. In edit mode
  // tiles are dragged to move them (others get pushed or swapped, locked ones never move), dragged
  // by the corner to resize them and clicked to open the editor. Values nobody can show yet are
  // sample numbers while editing; "Simulate ride" plays a made-up workout through the tiles.
  import {
    compactTiles,
    dropEmptyRows,
    GRID_COLUMNS,
    heartRateZone,
    caloriesKcal,
    layoutRows,
    PANEL_IDS,
    powerZone,
    targetFit,
    TEXT_METRIC_IDS,
    tileTarget,
    PREVIEW_SAMPLE_S,
    previewRide,
    type MetricId,
    type NumericMetricId,
    type PanelId,
    type Segment,
    type TextMetricId,
    type TargetFit,
    type TileSpec,
  } from '@cyclotron/core'
  import type { ComponentProps } from 'svelte'
  import { devices } from '../devices/devices.svelte'
  import { t } from '../i18n/t'
  import { describeSegment, formatDuration, segmentTarget } from '../lib/format'
  import { profile } from '../profile.svelte'
  import { controls } from '../ride/controls.svelte'
  import { rideLayout } from '../ride/layout.svelte'
  import { ride } from '../ride/session.svelte'
  import { worldPrefs } from '../world/prefs.svelte'
  import RidePanel from './RidePanel.svelte'
  import Tile from './Tile.svelte'
  import TileEditor from './TileEditor.svelte'

  interface Metric {
    value: number | string | undefined
    digits?: number
    unit?: string
    /** Shown instead of the short name (e.g. "Power · Z3"). */
    label?: string
    /** Zone colour for the tile's colour bar. */
    zone?: string
    /** Colour when it isn't the tile's first number (target and total muted). */
    secondary?: string
    /** Interval about to end: always in the warning colour. */
    hot?: boolean
    /** Has something to show here (before a ride, ride totals don't). */
    available: boolean
    /** Usual widest text, so the value keeps its place as digits come and go. */
    template?: string
  }

  /**
   * `editor`: always in edit mode, no "Done", editor beside the tiles, preview content (Settings →
   * Ride tiles). `fit`: the grid fills the height it is given and its rows share it (the Ride
   * screen during a ride), instead of rows of a fixed height.
   */
  let { editor = false, fit = false }: { editor?: boolean; fit?: boolean } = $props()
  const editing = $derived(editor || rideLayout.editing)

  // Leaving Settings closes the tile editor.
  $effect(() => () => {
    if (editor) rideLayout.selected = undefined
  })

  // ---- Values -------------------------------------------------------------------------------

  const UNITS: Partial<Record<MetricId, string>> = {
    power3s: 'W',
    power: 'W',
    power10s: 'W',
    target: 'W',
    intervalAvg: 'W',
    avgPower: 'W',
    maxPower: 'W',
    np: 'W',
    kcal: 'kcal',
    hr: 'bpm',
    avgHr: 'bpm',
    maxHr: 'bpm',
    cadence: 'rpm',
    cadenceTarget: 'rpm',
    avgCadence: 'rpm',
    speed: 'km/h',
    grade: '%',
    distance: 'km',
    toGo: 'km',
    elevation: 'm',
    climbed: 'm',
  }
  const DIGITS: Partial<Record<MetricId, number>> = {
    wkg: 1,
    if: 2,
    speed: 1,
    grade: 1,
    distance: 1,
    toGo: 1,
  }
  const TIMES = new Set<MetricId>(['intervalLeft', 'elapsed', 'total', 'workoutLeft'])
  /**
   * The width each number usually needs (watts and heart rate three digits, a ride time
   * H:MM:SS): reserved on the tile, so numbers don't jump left and right as their digits change.
   * Longer values still get their room.
   */
  const TEMPLATES: Partial<Record<NumericMetricId, string>> = {
    power3s: '000',
    power: '000',
    power10s: '000',
    target: '000',
    wkg: '0.0',
    intervalAvg: '000',
    avgPower: '000',
    maxPower: '000',
    np: '000',
    if: '0.00',
    tss: '000',
    kcal: '000',
    hr: '000',
    avgHr: '000',
    maxHr: '000',
    cadence: '000',
    cadenceTarget: '000',
    avgCadence: '000',
    speed: '00.0',
    intervalLeft: '00:00',
    elapsed: '0:00:00',
    total: '0:00:00',
    workoutLeft: '0:00:00',
    grade: '00.0',
    distance: '00.0',
    toGo: '00.0',
    elevation: '000',
    climbed: '000',
  }
  /** Tile tints for how close the rider is to the target. */
  const FIT_COLOURS: Record<TargetFit, string> = {
    on: 'var(--ok)',
    near: 'var(--warn)',
    off: 'var(--error)',
  }
  const SECONDARY: Partial<Record<MetricId, string>> = {
    target: 'var(--muted)',
    cadenceTarget: 'var(--muted)',
    total: 'var(--muted)',
    intervalLeft: 'var(--series-1)',
  }

  /** A metric from its raw number (seconds for times). */
  function metric(
    id: NumericMetricId,
    v: number | undefined,
    available: boolean,
    hot = false,
  ): Metric {
    const m: Metric = {
      value: TIMES.has(id) && v !== undefined ? formatDuration(Math.max(0, Math.ceil(v))) : v,
      digits: DIGITS[id],
      unit: UNITS[id],
      secondary: SECONDARY[id],
      available,
      template: TEMPLATES[id],
    }
    if (id === 'intervalLeft') m.hot = hot
    if ((id === 'power3s' || id === 'power' || id === 'power10s') && v && v > 0) {
      const z = powerZone(v, profile.ftpW)
      m.zone = `var(--z${z})`
      if (id === 'power3s') m.label = t().ride.powerZoneTile(z)
    }
    if (id === 'hr' && v && profile.maxHr) {
      const z = heartRateZone(v, profile.maxHr)
      m.zone = `var(--z${z})`
      m.label = t().ride.hrZoneTile(z)
    }
    if (id === 'wkg' && !profile.weightKg && v === undefined) m.label = t().ride.wkgSetWeight
    return m
  }

  const s = $derived(ride.state)

  /** What the ride shows now: raw numbers and whether each can show anything. */
  const live = $derived.by(() => {
    const m = ride.metrics
    const rideOn = ride.workout !== undefined
    const timed = s !== undefined && !ride.isFreeRide
    const route = ride.routeState
    const target = ride.active ? ride.targetW : controls.manualErgOn ? controls.ergWatts : undefined
    const remaining = s ? Math.ceil(s.segmentRemainingS) : 0
    const v: Record<NumericMetricId, number | undefined> = {
      power3s: devices.power3s,
      power: devices.data?.powerW,
      power10s: devices.power10s,
      target,
      wkg: profile.weightKg ? (devices.power3s ?? 0) / profile.weightKg : undefined,
      intervalAvg: ride.intervalAvgW,
      avgPower: m?.avgPowerW,
      maxPower: m?.maxPowerW,
      np: m?.normalizedPowerW,
      if: m?.intensity,
      tss: m?.tss,
      kcal: m && caloriesKcal(m.workKj),
      hr: devices.bpm,
      avgHr: m?.avgHeartRateBpm,
      maxHr: m?.maxHeartRateBpm,
      cadence: devices.data?.cadenceRpm,
      cadenceTarget: timed ? s.segment?.cadence : undefined,
      avgCadence: m?.avgCadenceRpm,
      speed: route ? route.speedKmh : devices.data?.speedKmh,
      intervalLeft: timed ? remaining : undefined,
      elapsed: s?.positionS,
      total: timed ? s.totalS : undefined,
      workoutLeft: timed ? Math.max(0, s.totalS - s.positionS) : undefined,
      grade: route?.position.gradePct,
      distance: route && route.distanceM / 1000,
      toGo: route && route.remainingM / 1000,
      elevation: route?.position.ele,
      climbed: route?.climbedM,
    }
    const always = new Set<MetricId>([
      'power3s',
      'power',
      'power10s',
      'wkg',
      'hr',
      'cadence',
      'speed',
    ])
    const routeIds = new Set<MetricId>(['grade', 'distance', 'toGo', 'elevation', 'climbed'])
    const available = (id: MetricId): boolean => {
      if (always.has(id)) return true
      if (id === 'target') return target !== undefined
      if (id === 'cadenceTarget') return v.cadenceTarget !== undefined
      if (routeIds.has(id)) return !!route
      if (id === 'elapsed') return rideOn
      if (id === 'intervalAvg' || TIMES.has(id)) return timed
      return rideOn
    }
    const hot = s?.status === 'running' && remaining <= 5 && s.next !== undefined
    // A paused or finished ride (zero power) isn't "off target".
    const going = s?.status === 'running' || (s === undefined && target !== undefined)
    return {
      v,
      available,
      hot,
      going,
      timed,
      segment: timed ? s.segment : undefined,
      next: s?.next,
    }
  })

  // ---- Simulation ---------------------------------------------------------------------------

  /** Seconds into the simulated ride; undefined = not simulating. */
  let simT = $state<number | undefined>()
  let simSpeed = $state(1)
  /** Hide the editing marks: the tiles exactly as on the bike. */
  let clean = $state(false)
  const SIM_START_S = 590

  $effect(() => {
    if (simT === undefined) return
    const speed = simSpeed
    const id = setInterval(() => (simT = (simT ?? 0) + speed), 1000)
    return () => clearInterval(id)
  })

  function toggleSim(): void {
    simT = simT === undefined ? SIM_START_S : undefined
    if (simT === undefined) clean = false
  }

  const preview = $derived(
    previewRide(simT ?? PREVIEW_SAMPLE_S, profile.ftpW, profile.weightKg ?? 75),
  )

  /** The step texts: words, coloured and sized like any value. */
  function stepTexts(
    segment: Segment | undefined,
    next: Segment | undefined,
  ): Record<TextMetricId, string | undefined> {
    return {
      step: segment && describeSegment(segment),
      stepTarget: segment && segmentTarget(segment),
      stepRepeat: segment?.repeat && `${segment.repeat.index}/${segment.repeat.count}`,
      nextStep: next && describeSegment(next),
    }
  }

  const metrics = $derived.by((): Record<MetricId, Metric> => {
    const out = {} as Record<MetricId, Metric>
    const sim = simT !== undefined
    const liveTexts = stepTexts(live.segment, live.next)
    const sampleTexts = stepTexts(preview.segment, preview.next)
    for (const id of TEXT_METRIC_IDS) {
      const value = sim
        ? sampleTexts[id]
        : (liveTexts[id] ?? (editing ? sampleTexts[id] : undefined))
      out[id] = { value, available: sim || live.timed }
    }
    for (const id of Object.keys(live.v) as NumericMetricId[]) {
      if (simT !== undefined) out[id] = metric(id, preview.values[id], true, preview.hot)
      else {
        // While editing, numbers that have nothing to show yet show a sample.
        const v = live.v[id] ?? (editing ? preview.values[id] : undefined)
        out[id] = metric(id, v, live.available(id), live.hot)
      }
    }
    return out
  })

  // ---- Tiles --------------------------------------------------------------------------------

  type TileProps = ComponentProps<typeof Tile>

  /** What a tile shows now; undefined hides it (nothing to show yet), except while editing. */
  function tileProps(spec: TileSpec): TileProps | undefined {
    if (spec.panel) return undefined
    const all = spec.metrics.map((id, i) => ({ id, m: metrics[id], color: spec.colors?.[i] }))
    const shown = editing || simT !== undefined ? all : all.filter((x) => x.m.available)
    if (shown.length === 0) return undefined
    const names = t().ride.metrics
    // In a tile of several numbers the first keeps the tile's colour, the others theirs (target
    // and total muted); the interval countdown is always coloured. A chosen colour wins.
    const own = (id: MetricId, i: number): boolean =>
      shown.length > 1 && !spec.fg && (i > 0 || id === 'intervalLeft')
    const parts = shown.map(({ id, m, color }, i) => ({
      value: m.value,
      digits: m.digits,
      unit: m.unit,
      name: m.label ?? names[id].short,
      color: m.hot ? 'var(--warn)' : (color ?? (own(id, i) ? m.secondary : undefined)),
      template: m.template,
    }))
    const second = shown[1]?.id
    return {
      label: parts[0]!.name,
      parts,
      sep: shown.length === 2 && (second === 'target' || second === 'cadenceTarget') ? '/' : '|',
      accent: spec.zoneBar === false ? undefined : shown.find((x) => x.m.zone)?.m.zone,
      bg: spec.bg,
      fg: spec.fg,
      tint: spec.targetTint ? tintFor(spec) : undefined,
      fill: true,
      align: spec.align,
      animation: spec.animation,
    }
  }

  /** The tile's tint for how close the rider is to the target (power or cadence). */
  function tintFor(spec: TileSpec): string | undefined {
    if (simT === undefined && !editing && !live.going) return undefined
    const pair = tileTarget(spec.metrics)
    if (!pair) return undefined
    const num = (id: MetricId): number | undefined => {
      const v = metrics[id].value
      return typeof v === 'number' ? v : undefined
    }
    const fit = targetFit(pair.kind, num(pair.actual), num(pair.target))
    return fit && FIT_COLOURS[fit]
  }

  const marks = $derived(editing && !clean)

  /** Whether this ride has anything to show in a panel. */
  function panelLive(panel: PanelId): boolean {
    const riding = ride.workout !== undefined
    switch (panel) {
      case 'workout':
        return riding && !ride.isFreeRide && ride.player !== undefined && s !== undefined
      case 'chart':
        return riding
      case 'route':
      case 'map':
        return !!(ride.route && ride.routeState)
      case 'world':
        return riding && worldPrefs.enabled
    }
  }

  type PanelMode = 'live' | 'preview' | 'placeholder'
  type Cell = { spec: TileSpec; props?: TileProps; panel?: PanelId; mode?: PanelMode }

  function cellFor(spec: TileSpec): Cell | undefined {
    if (!spec.panel) {
      const props = tileProps(spec)
      return props && { spec, props }
    }
    const mode: PanelMode | undefined = editor
      ? 'preview'
      : panelLive(spec.panel)
        ? 'live'
        : editing
          ? 'placeholder'
          : undefined
    return mode && { spec, panel: spec.panel, mode }
  }

  /** Tiles with their props; outside editing hidden tiles go and the rest close up. */
  const cells = $derived.by(() => {
    const list = rideLayout.tiles.map(cellFor).filter((c): c is Cell => c !== undefined)
    if (marks) return list.map((c) => ({ ...c, place: c.spec }))
    const places = dropEmptyRows(compactTiles(list.map((c) => c.spec)))
    return list.map((c, i) => ({ ...c, place: places[i]! }))
  })
  /** Rows on screen; while editing one more to drop tiles into. */
  const rows = $derived(Math.max(1, layoutRows(cells.map((c) => c.place)) + (marks ? 1 : 0)))
  /** Dashed grid cells behind the tiles while editing. */
  const guides = $derived(marks ? Array.from({ length: rows * GRID_COLUMNS }, (_, i) => i) : [])

  // ---- Dragging: pointer events on the grid (one listener for every tile) ----------------------

  let grid: HTMLDivElement | undefined = $state()
  let dragging = $state<string | undefined>()
  interface Drag {
    key: string
    mode: 'move' | 'resize'
    x: number
    y: number
    /** Layout and the tile's place when the drag started. */
    start: TileSpec[]
    from: TileSpec
    column: number
    row: number
    moved: boolean
  }
  let drag: Drag | undefined

  const keyAt = (el: EventTarget | Element | null): string | undefined =>
    (el instanceof Element ? el.closest<HTMLElement>('[data-key]') : null)?.dataset.key

  function down(e: PointerEvent): void {
    if (!marks || e.button !== 0 || !grid) return
    if (e.target instanceof Element && e.target.closest('[data-lock]')) return
    const key = keyAt(e.target)
    const spec = rideLayout.tiles.find((x) => x.key === key)
    if (!key || !spec) return
    const resize = e.target instanceof Element && e.target.closest('[data-resize]') !== null
    const cs = getComputedStyle(grid)
    const gap = parseFloat(cs.columnGap) || 0
    const rowGap = parseFloat(cs.rowGap) || 0
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
    drag = {
      key,
      mode: resize ? 'resize' : 'move',
      x: e.clientX,
      y: e.clientY,
      start: rideLayout.tiles,
      from: spec,
      column: (grid.clientWidth - padX + gap) / GRID_COLUMNS,
      row: (grid.clientHeight - padY + rowGap) / rows,
      moved: false,
    }
    grid.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function move(e: PointerEvent): void {
    const d = drag
    if (!d || !grid) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 5) return
    if (d.from.locked) return
    d.moved = true
    dragging = d.key
    const dc = Math.round(dx / d.column)
    const dr = Math.round(dy / d.row)
    rideLayout.place(
      d.key,
      d.mode === 'move'
        ? { x: d.from.x + dc, y: d.from.y + dr }
        : { w: d.from.w + dc, h: d.from.h + dr },
      d.start,
    )
  }

  function up(): void {
    const d = drag
    drag = undefined
    dragging = undefined
    if (!d) return
    if (d.moved) rideLayout.save()
    else if (d.mode === 'move') {
      rideLayout.selected = rideLayout.selected === d.key ? undefined : d.key
    }
  }

  /** Keyboard (Enter / Space on a tile's button) opens the editor; the mouse goes through up(). */
  function pick(e: MouseEvent, key: string): void {
    if (e.detail !== 0) return
    rideLayout.selected = rideLayout.selected === key ? undefined : key
  }

  function toggleLock(spec: TileSpec): void {
    rideLayout.update(spec.key, { locked: spec.locked ? undefined : true })
  }

  $effect(() => {
    const g = grid
    if (!g) return
    g.addEventListener('pointerdown', down)
    g.addEventListener('pointermove', move)
    g.addEventListener('pointerup', up)
    g.addEventListener('pointercancel', up)
    return () => {
      g.removeEventListener('pointerdown', down)
      g.removeEventListener('pointermove', move)
      g.removeEventListener('pointerup', up)
      g.removeEventListener('pointercancel', up)
    }
  })

  const L = $derived(t().ride.layout)
  const missingPanels = $derived(
    PANEL_IDS.filter((p) => !rideLayout.tiles.some((t) => t.panel === p)),
  )
  const SPEEDS = [1, 5, 20]
</script>

{#snippet lockIcon(locked: boolean)}
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
    <path
      d={locked ? 'M5 7V5a3 3 0 0 1 6 0v2' : 'M5 7V5a3 3 0 0 1 5.8-1'}
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
    />
  </svg>
{/snippet}

<div class="ride-tiles" class:fit>
  {#if editing}
    <div class="toolbar">
      {#if marks}<span class="muted">{L.hint}</span>{/if}
      <span class="spacer"></span>
      {#if editor}
        <button class:primary={simT === undefined} onclick={toggleSim}
          >{simT === undefined ? L.simulate : L.stopSim}</button
        >
        {#if simT !== undefined}
          <span class="speeds" role="group" aria-label={L.speed}>
            {#each SPEEDS as sp (sp)}
              <button class="small" class:sel={simSpeed === sp} onclick={() => (simSpeed = sp)}
                >{sp}×</button
              >
            {/each}
          </span>
          <span class="muted">{formatDuration(simT)}</span>
        {/if}
        <label class="check"
          ><input type="checkbox" bind:checked={clean} />
          {L.cleanView}</label
        >
      {/if}
      {#if marks}
        <button onclick={() => rideLayout.add()}>{L.add}</button>
        {#if missingPanels.length > 0}
          <select
            aria-label={L.addPanel}
            value=""
            onchange={(e) => {
              const v = e.currentTarget.value as PanelId
              e.currentTarget.value = ''
              if (v) rideLayout.addPanel(v)
            }}
          >
            <option value="">{L.addPanel}</option>
            {#each missingPanels as p (p)}<option value={p}>{L.panels[p].name}</option>{/each}
          </select>
        {/if}
        <button onclick={() => confirm(L.confirmReset) && rideLayout.reset()}>{L.reset}</button>
      {/if}
      {#if !editor}
        <button class="primary" onclick={() => rideLayout.stopEditing()}>{L.done}</button>
      {/if}
    </div>
    {#if !editor && rideLayout.selectedTile}
      <TileEditor tile={rideLayout.selectedTile} />
    {/if}
    {#if rideLayout.tiles.length === 0}<p class="muted">{L.empty}</p>{/if}
    {#if marks && simT === undefined}<p class="muted sample">{L.sampleNote}</p>{/if}
  {/if}

  <div class="workspace" class:side={editor && !clean} class:fit={fit || editor}>
    <div
      class="grid"
      class:stage={editor}
      class:editing={marks}
      bind:this={grid}
      style:grid-template-rows={fit || editor
        ? `repeat(${rows}, minmax(var(--row-min), 1fr))`
        : `repeat(${rows}, var(--row-h))`}
    >
      {#if marks}
        {#each guides as i (i)}
          <span
            class="guide"
            style:grid-column={(i % GRID_COLUMNS) + 1}
            style:grid-row={Math.floor(i / GRID_COLUMNS) + 1}
          ></span>
        {/each}
      {/if}
      {#each cells as { spec, props, panel, mode, place } (spec.key)}
        <div
          class="cell"
          class:selected={marks && rideLayout.selected === spec.key}
          class:dragging={dragging === spec.key}
          class:locked={marks && spec.locked}
          data-key={spec.key}
          style:grid-column="{place.x + 1} / span {place.w}"
          style:grid-row="{place.y + 1} / span {place.h}"
        >
          {#if panel && mode}
            <RidePanel {panel} {mode} {simT} style={spec.style} />
          {:else if props}
            <Tile {...props} />
          {/if}
          {#if marks}
            <button
              class="pick"
              aria-label={panel ? L.panels[panel].name : props?.label}
              onclick={(e) => pick(e, spec.key)}
            ></button>
            <button
              class="lock"
              class:on={spec.locked}
              data-lock
              title={spec.locked ? L.unlock : L.lock}
              aria-label={spec.locked ? L.unlock : L.lock}
              aria-pressed={!!spec.locked}
              onclick={() => toggleLock(spec)}>{@render lockIcon(!!spec.locked)}</button
            >
            {#if !spec.locked}<span class="resize" data-resize title={L.resize}></span>{/if}
          {/if}
        </div>
      {/each}
    </div>
    {#if editor && !clean}
      <aside class="panel">
        {#if rideLayout.selectedTile}
          <TileEditor tile={rideLayout.selectedTile} />
        {:else}
          <p class="muted">{L.pickTile}</p>
        {/if}
      </aside>
    {/if}
  </div>
</div>

<style>
  .ride-tiles.fit {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  /* Fills the height the page gives it (the Ride screen is a column as tall as the window). */
  .workspace.fit {
    flex: 1;
    min-height: 0;
    display: grid;
    /* A definite height for the grid, so its rows share it instead of growing with content. */
    grid-template-rows: minmax(0, 1fr);
  }
  .workspace.side {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem);
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 1100px) {
    .workspace.side {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .panel {
    position: sticky;
    top: 0.5rem;
  }
  .grid {
    /* One row: tall enough to read from the bike, shorter on a short window to leave the charts
       room (the Ride screen fits the window). */
    --row-h: clamp(5.5rem, 11vh, 9rem);
    /* With fit, rows share the height but never get smaller than this (then the page scrolls). */
    --row-min: 3.5rem;
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 0.75rem;
  }
  /* In Settings the tiles sit on the Ride screen's background, as they will on the bike. */
  /* The editor's stage is about as tall as the Ride screen's grid would be. */
  .grid.stage {
    min-height: max(28rem, calc(100vh - 16rem));
    box-sizing: border-box;
    background: var(--bg);
    padding: 0.75rem;
    border-radius: 10px;
  }
  .guide {
    border: 1px dashed color-mix(in srgb, var(--muted) 35%, transparent);
    border-radius: 6px;
    pointer-events: none;
  }
  .cell {
    position: relative;
    min-width: 0;
    min-height: 0;
    /* Sized by the grid only: a chart or the 3D canvas inside must never grow its row. */
    contain: size;
    transition:
      transform 0.15s,
      opacity 0.15s;
  }
  .editing .cell {
    cursor: grab;
    outline: 1px dashed var(--muted);
    outline-offset: 2px;
    border-radius: 8px;
    touch-action: none;
    user-select: none;
  }
  .editing .cell.locked {
    cursor: pointer;
    outline-style: solid;
  }
  .editing .cell.selected {
    outline: 2px solid var(--series-1);
  }
  .cell.dragging {
    opacity: 0.7;
    cursor: grabbing;
    z-index: 2;
  }
  .pick {
    position: absolute;
    inset: 0;
    background: transparent;
    border: none;
    padding: 0;
    cursor: inherit;
  }
  .lock {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    padding: 0.15rem 0.25rem;
    line-height: 0;
    border-radius: 6px;
    background: color-mix(in srgb, var(--bg, #000) 55%, transparent);
    color: var(--muted);
    border: none;
    opacity: 0.6;
  }
  .cell:hover .lock,
  .lock.on {
    opacity: 1;
  }
  .lock.on {
    color: var(--warn);
  }
  .resize {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 1.1rem;
    height: 1.1rem;
    cursor: nwse-resize;
    border-right: 3px solid var(--series-1);
    border-bottom: 3px solid var(--series-1);
    border-bottom-right-radius: 8px;
  }
  .toolbar {
    margin-bottom: 0.5rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .speeds {
    display: inline-flex;
    gap: 0.25rem;
  }
  .small {
    font-size: 0.85rem;
    padding: 0.1rem 0.5rem;
  }
  .sel {
    outline: 2px solid var(--series-1);
  }
  .check {
    margin-left: 0;
  }
  .spacer {
    flex: 1;
  }
  .primary {
    font-weight: 600;
  }
  .muted {
    color: var(--muted);
  }
  .sample {
    margin: 0 0 0.5rem;
    font-size: 0.85rem;
  }
  @media (prefers-reduced-motion: reduce) {
    .cell {
      transition: none;
    }
  }
</style>
