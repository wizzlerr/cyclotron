<script lang="ts">
  // The virtual world panel on the Ride screen (E16-6). Three.js is loaded only when this mounts.
  import { untrack } from 'svelte'
  import { devices } from '../devices/devices.svelte'
  import { formatNumber } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { ride } from '../ride/session.svelte'
  import { worldPrefs } from '../world/prefs.svelte'
  import type { WorldFeed, WorldView } from '../world/scene'

  /** Tallest the panel may get (a share of the window height). */
  let { maxHeight }: { maxHeight: number } = $props()

  /** Width of the panel; its height follows (a wide, cinema-like view). */
  let width = $state(0)
  const ASPECT = 2.35
  const MIN_HEIGHT = 200
  const height = $derived(Math.round(Math.max(MIN_HEIGHT, Math.min(maxHeight, width / ASPECT))))

  let canvas = $state<HTMLCanvasElement>()
  let view: WorldView | undefined
  let error = $state<string | undefined>()

  /** Read by the render loop every frame; plain reads, no reactivity needed. */
  function feed(): WorldFeed {
    const rs = ride.routeState
    const speedKmh = rs ? rs.speedKmh : (devices.data?.speedKmh ?? 0)
    return {
      route: ride.route,
      routeD: rs?.position.d,
      speedMps: speedKmh / 3.6,
      cadenceRpm: devices.data?.cadenceRpm ?? 0,
      running: ride.state?.status === 'running',
    }
  }

  $effect(() => {
    const el = canvas
    // A different route means a different world.
    void ride.route
    if (!el) return
    let cancelled = false
    void import('../world/scene')
      .then(({ createWorld }) => {
        if (cancelled) return
        view = createWorld(
          el,
          feed,
          untrack(() => worldPrefs.quality),
        )
      })
      .catch((e: unknown) => (error = e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
      view?.dispose()
      view = undefined
    }
  })

  $effect(() => view?.setQuality(worldPrefs.quality))

  const grade = $derived(ride.routeState?.position.gradePct)
</script>

<div class="world card" style:height="{height}px" bind:clientWidth={width}>
  <canvas bind:this={canvas} aria-label={t().world.label}></canvas>
  {#if grade !== undefined}
    <span class="hud">{formatNumber(grade, 1)} %</span>
  {/if}
  {#if error}<p class="error">{t().world.failed(error)}</p>{/if}
</div>

<style>
  .world {
    position: relative;
    max-width: none;
    margin-top: 0.75rem;
    padding: 0;
    overflow: hidden;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .hud {
    position: absolute;
    top: 0.6rem;
    left: 0.75rem;
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    background: rgb(17 20 24 / 0.7);
    color: var(--fg);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .error {
    position: absolute;
    inset: auto 0.75rem 0.5rem;
    color: var(--error);
  }
</style>
