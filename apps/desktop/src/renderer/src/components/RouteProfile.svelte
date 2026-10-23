<script lang="ts">
  // E13-5: elevation profile of a route, coloured by grade, with the rider's position.
  import { ROUTE_STEP_M, routeAt, type Route } from '@cyclotron/core'
  import { formatNumber } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { formatKm } from '../lib/format'

  let {
    route,
    positionM = undefined,
    height = 120,
    axes = false,
    onhover = undefined,
  }: {
    route: Route
    positionM?: number
    height?: number
    axes?: boolean
    /** The distance under the cursor, or `undefined` when it leaves. */
    onhover?: (d: number | undefined) => void
  } = $props()

  const W = 1000
  /** At most this many blocks are drawn, however long the route. */
  const MAX_BINS = 120
  /** Each block's colour is the grade over at least this distance, so it reads as the climb. */
  const MIN_BIN_M = 250

  const minEle = $derived(Math.min(...route.points.map((p) => p.ele)))
  const maxEle = $derived(Math.max(...route.points.map((p) => p.ele)))
  // Leave room below the lowest point and keep flat routes from looking mountainous.
  // At least 50 m of scale, so a flat route looks flat but its small rises still show. Below sea
  // level (the Afsluitdijk) is allowed.
  const span = $derived(Math.max(50, (maxEle - minEle) * 1.2))
  const yMin = $derived(minEle - (span - (maxEle - minEle)) * 0.6)
  const yMax = $derived(yMin + span)

  const x = (d: number): number => (d / route.distanceM) * W
  const y = (ele: number): number => height - ((ele - yMin) / (yMax - yMin)) * height

  const bins = $derived.by(() => {
    const pts = route.points
    const per = Math.ceil(Math.max((pts.length - 1) / MAX_BINS, MIN_BIN_M / ROUTE_STEP_M))
    const out = []
    for (let i = 0; i < pts.length - 1; i += per) {
      const a = pts[i]!
      const b = pts[Math.min(pts.length - 1, i + per)]!
      const grade = b.d > a.d ? ((b.ele - a.ele) / (b.d - a.d)) * 100 : 0
      out.push({
        points: `${x(a.d)},${height} ${x(a.d)},${y(a.ele)} ${x(b.d)},${y(b.ele)} ${x(b.d)},${height}`,
        fill: gradeColor(grade),
      })
    }
    return out
  })

  function gradeColor(g: number): string {
    if (g < -2) return 'var(--z2)'
    if (g < 3) return 'var(--z3)'
    if (g < 6) return 'var(--z4)'
    if (g < 9) return 'var(--z5)'
    if (g < 12) return 'var(--z6)'
    return 'var(--z7)'
  }

  function niceStep(range: number, steps: readonly number[]): number {
    return steps.find((s) => range / s <= 5) ?? steps.at(-1)!
  }
  const yTicks = $derived.by(() => {
    const step = niceStep(yMax - yMin, [10, 20, 50, 100, 200, 250, 500, 1000])
    const ticks = []
    for (let e = Math.ceil(yMin / step) * step; e < yMax; e += step) ticks.push(e)
    return ticks
  })
  const xTicks = $derived.by(() => {
    const step = niceStep(route.distanceM, [500, 1000, 2000, 5000, 10_000, 20_000, 50_000])
    const ticks = []
    for (let d = 0; d <= route.distanceM; d += step) ticks.push(d)
    return ticks
  })

  let hover = $state<{ x: number; d: number } | undefined>()
  let plotWidth = $state(0)
  function onMove(e: PointerEvent): void {
    const rect = (e.currentTarget as Element).getBoundingClientRect()
    const px = e.clientX - rect.left
    hover = { x: px, d: (px / rect.width) * route.distanceM }
    onhover?.(hover.d)
  }
  function onLeave(): void {
    hover = undefined
    onhover?.(undefined)
  }
  const tip = $derived(hover && routeAt(route, hover.d))
</script>

<div class="profile" class:axes>
  {#if axes}
    <span class="axis-title y-title">{t().ride.profile.elevationAxis}</span>
    <div class="y-ticks" style:height="{height}px">
      {#each yTicks as tick (tick)}
        <span style:top="{(y(tick) / height) * 100}%">{tick}</span>
      {/each}
    </div>
  {/if}

  <div
    class="plot"
    role="presentation"
    bind:clientWidth={plotWidth}
    onpointermove={onMove}
    onpointerleave={onLeave}
  >
    <svg
      viewBox="0 0 {W} {height}"
      preserveAspectRatio="none"
      style:height="{height}px"
      role="img"
      aria-label={t().ride.profile.elevationProfile}
    >
      {#if axes}
        {#each yTicks as tick (tick)}
          <line class="grid" x1="0" x2={W} y1={y(tick)} y2={y(tick)} />
        {/each}
      {/if}
      {#each bins as b, i (i)}
        <polygon points={b.points} fill={b.fill} />
      {/each}
      {#if positionM !== undefined}
        <rect class="done" x="0" y="0" width={x(positionM)} {height} />
        <line class="now" x1={x(positionM)} x2={x(positionM)} y1="0" y2={height} />
      {/if}
      {#if hover}
        <line class="cursor" x1={x(hover.d)} x2={x(hover.d)} y1="0" y2={height} />
      {/if}
    </svg>
    {#if tip && hover}
      <div class="tip" class:left={hover.x > plotWidth / 2} style:left="{hover.x}px">
        <strong>{formatNumber(tip.gradePct, 1)} %</strong>
        <span>{Math.round(tip.ele)} m</span>
        <span class="muted">{t().ride.profile.at(formatKm(tip.d))}</span>
      </div>
    {/if}
  </div>

  {#if axes}
    <div class="x-ticks">
      {#each xTicks as tick (tick)}
        <span style:left="{(tick / route.distanceM) * 100}%">{formatNumber(tick / 1000)}</span>
      {/each}
    </div>
    <span class="axis-title x-title">{t().ride.profile.distanceAxis}</span>
  {/if}
</div>

<style>
  .profile {
    position: relative;
  }
  .profile.axes {
    display: grid;
    grid-template-columns: 1rem 2.5rem 1fr;
    grid-template-rows: auto 1.25rem auto;
    column-gap: 0.25rem;
  }
  .plot {
    position: relative;
    grid-column: 3;
    grid-row: 1;
  }
  svg {
    display: block;
    width: 100%;
  }
  polygon {
    stroke: none;
  }
  .grid {
    stroke: var(--z-none);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    opacity: 0.5;
  }
  .done {
    fill: var(--bg);
    opacity: 0.45;
    pointer-events: none;
  }
  .now {
    stroke: var(--fg);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }
  .cursor {
    stroke: var(--fg);
    stroke-width: 1;
    stroke-dasharray: 3 3;
    vector-effect: non-scaling-stroke;
    opacity: 0.7;
  }
  .axis-title {
    color: var(--muted);
    font-size: 0.75rem;
  }
  .y-title {
    grid-column: 1;
    grid-row: 1;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    text-align: center;
    align-self: center;
  }
  .y-ticks {
    grid-column: 2;
    grid-row: 1;
    position: relative;
  }
  .y-ticks span {
    position: absolute;
    right: 0;
    transform: translateY(-50%);
    font-size: 0.7rem;
    color: var(--muted);
  }
  .x-ticks {
    grid-column: 3;
    grid-row: 2;
    position: relative;
  }
  .x-ticks span {
    position: absolute;
    top: 0.1rem;
    transform: translateX(-50%);
    font-size: 0.7rem;
    color: var(--muted);
  }
  .x-ticks span:first-child {
    transform: none;
  }
  .x-title {
    grid-column: 3;
    grid-row: 3;
    text-align: center;
  }
  .tip {
    position: absolute;
    top: 0.25rem;
    transform: translateX(0.5rem);
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.35rem 0.55rem;
    background: var(--panel);
    border: 1px solid var(--z-none);
    border-radius: 6px;
    font-size: 0.8rem;
    white-space: nowrap;
    pointer-events: none;
    z-index: 2;
  }
  .tip.left {
    transform: translateX(calc(-100% - 0.5rem));
  }
  .tip strong {
    font-size: 1rem;
  }
</style>
