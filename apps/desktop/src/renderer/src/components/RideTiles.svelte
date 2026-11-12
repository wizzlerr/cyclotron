<script lang="ts">
  // The Ride screen tiles, laid out by the rider (E4-6): a 12-column grid of tiles, each showing
  // 1–3 numbers in its own size and colours. In edit mode tiles are dragged to move them, dragged
  // by the corner to resize them and clicked to open the editor.
  import {
    caloriesKcal,
    GRID_COLUMNS,
    heartRateZone,
    powerZone,
    type MetricId,
    type TileSpec,
  } from '@cyclotron/core'
  import type { ComponentProps } from 'svelte'
  import { devices } from '../devices/devices.svelte'
  import { formatNumber } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { formatDuration } from '../lib/format'
  import { profile } from '../profile.svelte'
  import { controls } from '../ride/controls.svelte'
  import { rideLayout } from '../ride/layout.svelte'
  import { ride } from '../ride/session.svelte'
  import Tile from './Tile.svelte'
  import TileEditor from './TileEditor.svelte'

  interface Metric {
    value: number | string | undefined
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
  }

  /** `editor`: always in edit mode, no "Done" (Settings → Ride screen). */
  let { editor = false }: { editor?: boolean } = $props()
  const editing = $derived(editor || rideLayout.editing)

  // Leaving Settings closes the tile editor.
  $effect(() => () => {
    if (editor) rideLayout.selected = undefined
  })
  const s = $derived(ride.state)
  const remaining = $derived(s ? Math.ceil(s.segmentRemainingS) : 0)

  const fixed = (n: number | undefined, digits: number): string | undefined =>
    n === undefined ? undefined : formatNumber(n, digits)

  const metrics = $derived.by((): Record<MetricId, Metric> => {
    const m = ride.metrics
    const rideOn = ride.workout !== undefined
    const timed = s !== undefined && !ride.isFreeRide
    const route = ride.routeState
    const target = ride.active ? ride.targetW : controls.manualErgOn ? controls.ergWatts : undefined
    const ftp = profile.ftpW
    const power = (v: number | undefined, label?: (z: number) => string): Metric => {
      const z = v && v > 0 ? powerZone(v, ftp) : undefined
      return {
        value: v,
        unit: 'W',
        zone: z ? `var(--z${z})` : undefined,
        label: z && label ? label(z) : undefined,
        available: true,
      }
    }
    const hrZ = devices.bpm && profile.maxHr ? heartRateZone(devices.bpm, profile.maxHr) : undefined
    return {
      power3s: power(devices.power3s, (z) => t().ride.powerZoneTile(z)),
      power: power(devices.data?.powerW),
      power10s: power(devices.power10s),
      target: {
        value: target,
        unit: 'W',
        secondary: 'var(--muted)',
        available: target !== undefined,
      },
      wkg: {
        value: profile.weightKg ? fixed((devices.power3s ?? 0) / profile.weightKg, 1) : undefined,
        label: profile.weightKg ? undefined : t().ride.wkgSetWeight,
        available: true,
      },
      intervalAvg: { value: ride.intervalAvgW, unit: 'W', available: timed },
      avgPower: { value: m?.avgPowerW, unit: 'W', available: rideOn },
      maxPower: { value: m?.maxPowerW, unit: 'W', available: rideOn },
      np: { value: m?.normalizedPowerW, unit: 'W', available: rideOn },
      if: { value: fixed(m?.intensity, 2), available: rideOn },
      tss: { value: m?.tss, available: rideOn },
      kcal: { value: m && caloriesKcal(m.workKj), unit: 'kcal', available: rideOn },
      hr: {
        value: devices.bpm,
        unit: 'bpm',
        zone: hrZ ? `var(--z${hrZ})` : undefined,
        label: hrZ ? t().ride.hrZoneTile(hrZ) : undefined,
        available: true,
      },
      avgHr: { value: m?.avgHeartRateBpm, unit: 'bpm', available: rideOn },
      maxHr: { value: m?.maxHeartRateBpm, unit: 'bpm', available: rideOn },
      cadence: { value: devices.data?.cadenceRpm, unit: 'rpm', available: true },
      avgCadence: { value: m?.avgCadenceRpm, unit: 'rpm', available: rideOn },
      speed: {
        value: route ? fixed(route.speedKmh, 1) : devices.data?.speedKmh,
        unit: 'km/h',
        available: true,
      },
      intervalLeft: {
        value: timed ? formatDuration(remaining) : undefined,
        secondary: 'var(--series-1)',
        hot: s?.status === 'running' && remaining <= 5 && s.next !== undefined,
        available: timed,
      },
      elapsed: { value: s ? formatDuration(s.positionS) : undefined, available: rideOn },
      total: {
        value: timed ? formatDuration(s.totalS) : undefined,
        secondary: 'var(--muted)',
        available: timed,
      },
      workoutLeft: {
        value: timed ? formatDuration(Math.max(0, s.totalS - s.positionS)) : undefined,
        available: timed,
      },
      grade: { value: fixed(route?.position.gradePct, 1), unit: '%', available: !!route },
      distance: {
        value: fixed(route && route.distanceM / 1000, 1),
        unit: 'km',
        available: !!route,
      },
      toGo: { value: fixed(route && route.remainingM / 1000, 1), unit: 'km', available: !!route },
      elevation: {
        value: route && Math.round(route.position.ele),
        unit: 'm',
        available: !!route,
      },
      climbed: { value: route && Math.round(route.climbedM), unit: 'm', available: !!route },
    }
  })

  type TileProps = ComponentProps<typeof Tile>

  /** What a tile shows now; undefined hides it (nothing to show yet), except while editing. */
  function tileProps(spec: TileSpec): TileProps | undefined {
    const all = spec.metrics.map((id) => ({ id, m: metrics[id] }))
    const shown = editing ? all : all.filter((x) => x.m.available)
    if (shown.length === 0) return undefined
    const names = t().ride.metrics
    // In a tile of several numbers the first keeps the tile's colour, the others theirs (target
    // and total muted); the interval countdown is always coloured. A chosen colour wins.
    const own = (id: MetricId, i: number): boolean =>
      shown.length > 1 && !spec.fg && (i > 0 || id === 'intervalLeft')
    const parts = shown.map(({ id, m }, i) => ({
      value: m.value,
      unit: m.unit,
      name: m.label ?? names[id].short,
      color: m.hot ? 'var(--warn)' : own(id, i) ? m.secondary : undefined,
    }))
    return {
      label: parts[0]!.name,
      parts,
      sep: shown.length === 2 && shown[1]!.id === 'target' ? '/' : '|',
      accent: spec.zoneBar === false ? undefined : shown.find((x) => x.m.zone)?.m.zone,
      bg: spec.bg,
      fg: spec.fg,
      fill: true,
    }
  }

  // Dragging: pointer events on the grid (one listener for every tile).
  let grid: HTMLDivElement | undefined = $state()
  let dragging = $state<string | undefined>()
  interface Drag {
    key: string
    mode: 'move' | 'resize'
    x: number
    y: number
    w: number
    h: number
    moved: boolean
    /** Tile last swapped with, so a big and a small tile don't swap back and forth. */
    last?: string
  }
  let drag: Drag | undefined

  const keyAt = (el: EventTarget | Element | null): string | undefined =>
    (el instanceof Element ? el.closest<HTMLElement>('[data-key]') : null)?.dataset.key

  function down(e: PointerEvent): void {
    if (!editing || e.button !== 0 || !grid) return
    const key = keyAt(e.target)
    const spec = rideLayout.tiles.find((x) => x.key === key)
    if (!key || !spec) return
    const resize = e.target instanceof Element && e.target.closest('[data-resize]') !== null
    drag = {
      key,
      mode: resize ? 'resize' : 'move',
      x: e.clientX,
      y: e.clientY,
      w: spec.w,
      h: spec.h,
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
    d.moved = true
    dragging = d.key
    if (d.mode === 'move') {
      const over = keyAt(document.elementFromPoint(e.clientX, e.clientY))
      if (!over) d.last = undefined
      else if (over !== d.key && over !== d.last) {
        rideLayout.move(d.key, over)
        d.last = over
      }
      return
    }
    const cs = getComputedStyle(grid)
    const gap = parseFloat(cs.columnGap) || 0
    const column = (grid.clientWidth + gap) / GRID_COLUMNS
    const row = (parseFloat(cs.gridAutoRows) || 80) + (parseFloat(cs.rowGap) || 0)
    rideLayout.update(
      d.key,
      { w: d.w + Math.round(dx / column), h: d.h + Math.round(dy / row) },
      false,
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
</script>

{#if editing}
  <div class="toolbar">
    <span class="muted">{L.hint}</span>
    <span class="spacer"></span>
    <button onclick={() => rideLayout.add()}>{L.add}</button>
    <button onclick={() => confirm(L.confirmReset) && rideLayout.reset()}>{L.reset}</button>
    {#if !editor}
      <button class="primary" onclick={() => rideLayout.stopEditing()}>{L.done}</button>
    {/if}
  </div>
  {#if rideLayout.selectedTile}
    <TileEditor tile={rideLayout.selectedTile} />
  {/if}
  {#if rideLayout.tiles.length === 0}<p class="muted">{L.empty}</p>{/if}
{/if}

<div class="grid" class:editing bind:this={grid}>
  {#each rideLayout.tiles as spec (spec.key)}
    {@const props = tileProps(spec)}
    {#if props}
      <div
        class="cell"
        class:selected={editing && rideLayout.selected === spec.key}
        class:dragging={dragging === spec.key}
        data-key={spec.key}
        style:grid-column="span {spec.w}"
        style:grid-row="span {spec.h}"
      >
        <Tile {...props} />
        {#if editing}
          <button class="pick" aria-label={props.label} onclick={(e) => pick(e, spec.key)}></button>
          <span class="resize" data-resize title={L.resize}></span>
        {/if}
      </div>
    {/if}
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    /* One row: tall enough to read from the bike, shorter on a short window to leave the charts
       room (the Ride screen fits the window). */
    grid-auto-rows: clamp(5.5rem, 11vh, 9rem);
    grid-auto-flow: row dense;
    gap: 0.75rem;
  }
  .cell {
    position: relative;
    min-width: 0;
    min-height: 0;
  }
  .editing .cell {
    cursor: grab;
    outline: 1px dashed var(--muted);
    outline-offset: 2px;
    border-radius: 8px;
    touch-action: none;
    user-select: none;
  }
  .editing .cell.selected {
    outline: 2px solid var(--series-1);
  }
  .cell.dragging {
    opacity: 0.6;
    cursor: grabbing;
  }
  .pick {
    position: absolute;
    inset: 0;
    background: transparent;
    border: none;
    padding: 0;
    cursor: inherit;
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
  .spacer {
    flex: 1;
  }
  .primary {
    font-weight: 600;
  }
  .muted {
    color: var(--muted);
  }
</style>
