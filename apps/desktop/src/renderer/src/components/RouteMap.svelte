<script lang="ts">
  // E13-5: the route's outline from its GPS points (no map tiles, works offline), with the rider.
  import { ROUTE_STEP_M, routeAt, type Route } from '@cyclotron/core'
  import { routeName } from '../i18n/content'
  import { t } from '../i18n/t'

  let {
    route,
    position = undefined,
    size = 160,
    fromM = undefined,
    hoverM = undefined,
    onpick = undefined,
  }: {
    route: Route
    position?: { lat: number; lon: number }
    size?: number
    /** Start part-way: marks the start there, with the riding direction, and greys out the
     * skipped road (a loop is ridden all the way round, so none of it is skipped). */
    fromM?: number
    /** A point to mark, e.g. under the cursor on the elevation profile. */
    hoverM?: number
    /** Makes the outline clickable: called with the distance of the nearest point. */
    onpick?: (d: number) => void
  } = $props()

  const PAD = 8
  /** Outline points drawn; enough for a smooth line at this size. */
  const MAX_POINTS = 400

  // Equirectangular projection, longitudes shrunk by cos(latitude) so shapes aren't stretched.
  const frame = $derived.by(() => {
    const pts = route.points
    const midLat = (Math.min(...pts.map((p) => p.lat)) + Math.max(...pts.map((p) => p.lat))) / 2
    const k = Math.cos((midLat * Math.PI) / 180)
    const xs = pts.map((p) => p.lon * k)
    const ys = pts.map((p) => p.lat)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1
    const scale = (size - 2 * PAD) / span
    // Centre the shorter side.
    const offX = (size - 2 * PAD - (Math.max(...xs) - minX) * scale) / 2
    const offY = (size - 2 * PAD - (Math.max(...ys) - minY) * scale) / 2
    return (lat: number, lon: number): [number, number] => [
      PAD + offX + (lon * k - minX) * scale,
      size - PAD - offY - (lat - minY) * scale,
    ]
  })

  const projected = $derived(route.points.map((p) => frame(p.lat, p.lon)))
  /** Index of the point at the chosen start (points are ROUTE_STEP_M apart). */
  const fromIndex = $derived(
    fromM === undefined
      ? 0
      : Math.min(projected.length - 1, Math.max(0, Math.round(fromM / ROUTE_STEP_M))),
  )

  function polyline(from: number, to: number): string {
    const every = Math.max(1, Math.ceil(projected.length / MAX_POINTS))
    return projected
      .filter((_, i) => i >= from && i <= to && (i % every === 0 || i === from || i === to))
      .map((xy) => xy.map((n) => n.toFixed(1)).join(','))
      .join(' ')
  }
  const skippedLine = $derived(fromIndex > 0 && !route.loop ? polyline(0, fromIndex) : undefined)
  const line = $derived(polyline(skippedLine ? fromIndex : 0, projected.length - 1))

  const start = $derived(projected[fromIndex]!)
  const end = $derived(projected.at(-1)!)
  const here = $derived(position && frame(position.lat, position.lon))
  const hover = $derived.by(() => {
    if (hoverM === undefined) return undefined
    const p = routeAt(route, hoverM)
    return frame(p.lat, p.lon)
  })

  /** Arrow a little way along the road from the start, pointing the way the route goes. */
  const arrow = $derived.by(() => {
    if (fromM === undefined) return undefined
    const n = projected.length
    const ahead = Math.max(2, Math.round(n / 25))
    const a = projected[(fromIndex + ahead) % n]!
    const b = projected[(fromIndex + ahead + Math.max(1, Math.round(n / 100))) % n]!
    const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
    return { x: a[0], y: a[1], angle }
  })

  function pick(e: MouseEvent): void {
    if (!onpick) return
    const rect = (e.currentTarget as Element).getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * size
    const y = ((e.clientY - rect.top) / rect.height) * size
    let best = 0
    let bestD = Infinity
    projected.forEach(([px, py], i) => {
      const d = (px - x) ** 2 + (py - y) ** 2
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    onpick(route.points[best]!.d)
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<svg
  class:pickable={!!onpick}
  onclick={pick}
  width={size}
  height={size}
  viewBox="0 0 {size} {size}"
  role="img"
  aria-label={t().ride.profile.routeOutline(routeName(route))}
>
  {#if skippedLine}<polyline class="skipped" points={skippedLine} />{/if}
  <polyline class:chosen={fromM !== undefined} points={line} />
  {#if arrow}
    <polygon
      class="arrow"
      points="-5,-4.5 6,0 -5,4.5"
      transform="translate({arrow.x.toFixed(1)} {arrow.y.toFixed(1)}) rotate({arrow.angle.toFixed(
        0,
      )})"
    />
  {/if}
  {#if !route.loop}<circle class="end" cx={end[0]} cy={end[1]} r="4" />{/if}
  <circle class="start" cx={start[0]} cy={start[1]} r={fromM === undefined ? 4 : 5.5} />
  {#if hover}<circle class="hover" cx={hover[0]} cy={hover[1]} r="4" />{/if}
  {#if here}<circle class="here" cx={here[0]} cy={here[1]} r="6" />{/if}
</svg>

<style>
  svg {
    display: block;
    flex: none;
  }
  polyline {
    fill: none;
    stroke: var(--muted);
    stroke-width: 2.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  polyline.chosen {
    stroke: var(--series-1);
  }
  polyline.skipped {
    stroke-dasharray: 2 4;
    opacity: 0.6;
  }
  .pickable {
    cursor: pointer;
  }
  .arrow {
    fill: var(--fg);
  }
  .hover {
    fill: none;
    stroke: var(--fg);
    stroke-width: 1.5;
  }
  .start {
    fill: var(--ok);
  }
  .end {
    fill: var(--error);
  }
  .here {
    fill: var(--fg);
    stroke: var(--bg);
    stroke-width: 2;
  }
</style>
