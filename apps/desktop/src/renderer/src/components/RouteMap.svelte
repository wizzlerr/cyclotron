<script lang="ts">
  // E13-5: the route's outline from its GPS points (no map tiles, works offline), with the rider.
  import type { Route } from '@cyclotron/core'

  let {
    route,
    position = undefined,
    size = 160,
  }: { route: Route; position?: { lat: number; lon: number }; size?: number } = $props()

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

  const line = $derived.by(() => {
    const pts = route.points
    const every = Math.max(1, Math.ceil(pts.length / MAX_POINTS))
    const keep = pts.filter((_, i) => i % every === 0 || i === pts.length - 1)
    return keep
      .map((p) =>
        frame(p.lat, p.lon)
          .map((n) => n.toFixed(1))
          .join(','),
      )
      .join(' ')
  })
  const start = $derived(frame(route.points[0]!.lat, route.points[0]!.lon))
  const end = $derived(frame(route.points.at(-1)!.lat, route.points.at(-1)!.lon))
  const here = $derived(position && frame(position.lat, position.lon))
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 {size} {size}"
  role="img"
  aria-label="Route outline of {route.name}"
>
  <polyline points={line} />
  {#if !route.loop}<circle class="end" cx={end[0]} cy={end[1]} r="4" />{/if}
  <circle class="start" cx={start[0]} cy={start[1]} r="4" />
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
