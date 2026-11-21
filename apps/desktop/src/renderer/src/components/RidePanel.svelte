<script lang="ts">
  // One of the big parts of the Ride screen in a grid cell of the rider's layout (D37): workout
  // profile, live chart, route profile, route map or the virtual world. Sized by its cell and
  // styled by the rider (`style`: background, text size and colour, which parts show). `live`
  // shows the ride; `preview` the layout editor's made-up ride (`simT` seconds in); `placeholder`
  // only names the panel (editing, when this ride has nothing to show in it).
  import {
    builtinRoutes,
    PREVIEW_SAMPLE_S,
    previewChart,
    previewRide,
    previewTimeline,
    routeAt,
    type PanelId,
    type PanelStyle,
  } from '@cyclotron/core'
  import { formatNumber } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { describeSegment as describe, formatDuration } from '../lib/format'
  import { profile } from '../profile.svelte'
  import { ride } from '../ride/session.svelte'
  import LiveChart from './LiveChart.svelte'
  import RouteMap from './RouteMap.svelte'
  import RouteProfile from './RouteProfile.svelte'
  import WorkoutProfile from './WorkoutProfile.svelte'
  import WorldView from './WorldView.svelte'

  let {
    panel,
    mode,
    simT = undefined,
    style = undefined,
  }: {
    panel: PanelId
    mode: 'live' | 'preview' | 'placeholder'
    simT?: number
    style?: PanelStyle
  } = $props()

  const ts = $derived(style?.textScale ?? 1)
  const axes = $derived(style?.axes !== false)
  const titles = $derived(style?.titles !== false)
  /** Room for the profiles' axis numbers and title under the plot. */
  const axisPx = $derived(axes ? Math.round((titles ? 40 : 22) * ts) : 0)
  /** The chart's legend line under the plot. */
  const legendPx = $derived(style?.legend === false ? 0 : Math.round(30 * ts))

  /** The plot keeps a usable height when big texts take most of a small panel. */
  const plotH = (room: number, texts: number): number =>
    Math.max(Math.round(room / 2), room - texts)

  let w = $state(0)
  let h = $state(0)

  // The preview ride: a fixed workout, and the first built-in route ridden at its speed.
  const at = $derived(simT ?? PREVIEW_SAMPLE_S)
  const timeline = previewTimeline()
  const route = builtinRoutes()[0]
  const sample = $derived(previewRide(at, profile.ftpW))
  const routePos = $derived(
    route ? routeAt(route, (sample.values.distance * 1000) % route.distanceM) : undefined,
  )
  const chart = $derived(
    mode === 'preview' && panel === 'chart' ? previewChart(at, profile.ftpW) : undefined,
  )

  const s = $derived(ride.state)
  const L = $derived(t().ride.layout)

  /** The line under the workout profile: live, or the preview's. */
  const nextLine = $derived.by((): string | undefined => {
    if (style?.next === false) return undefined
    if (mode === 'live') {
      if (!s?.next) return undefined
      const watts = s.nextTargetW ? ` · ${s.nextTargetW} W` : ''
      return (
        t().ride.nextIn(formatDuration(Math.ceil(s.segmentRemainingS)), describe(s.next)) + watts
      )
    }
    if (!sample.next) return undefined
    return t().ride.nextIn(
      formatDuration(Math.ceil(sample.values.intervalLeft)),
      describe(sample.next),
    )
  })
</script>

{#snippet note(text: string)}
  <p
    class="next"
    style:color={style?.nextColor}
    style:font-size={style?.nextScale ? `${style.nextScale}em` : undefined}
  >
    {text}
  </p>
{/snippet}

<div class="panel" class:bare={panel === 'world' && mode === 'live'} style:background={style?.bg}>
  {#if mode === 'placeholder' || (mode === 'preview' && panel === 'world')}
    <div class="placeholder">
      <b>{L.panels[panel].name}</b>
      <span>{L.panels[panel].when}</span>
    </div>
  {:else if panel === 'workout'}
    {@const live = mode === 'live' && ride.player && s}
    <div class="plot" bind:clientWidth={w} bind:clientHeight={h}>
      {#if h > 30}
        <WorkoutProfile
          timeline={live ? ride.player!.timeline : timeline}
          positionS={live ? s!.positionS : at}
          ftpW={live ? ride.player!.ftpW * s!.intensity : profile.ftpW}
          height={plotH(h, axisPx)}
          {axes}
          {titles}
          ftpLine={style?.ftp !== false}
          textScale={ts}
          textColor={style?.text}
        />
      {/if}
    </div>
    {#if nextLine}{@render note(nextLine)}{/if}
  {:else if panel === 'chart'}
    <div class="plot" bind:clientWidth={w} bind:clientHeight={h}>
      {#if h > 40}
        <LiveChart
          height={plotH(h, legendPx)}
          data={chart}
          version={chart ? at : undefined}
          {axes}
          {titles}
          legend={style?.legend !== false}
          textScale={ts}
          textColor={style?.text}
        />
      {/if}
    </div>
  {:else if panel === 'route'}
    {@const r = mode === 'live' ? ride.route : route}
    {@const pos = mode === 'live' ? ride.routeState?.position : routePos}
    <div class="plot" bind:clientWidth={w} bind:clientHeight={h}>
      {#if r && h > 30}
        <RouteProfile
          route={r}
          positionM={pos?.d}
          height={plotH(h, axisPx)}
          {axes}
          {titles}
          textScale={ts}
          textColor={style?.text}
        />
      {/if}
    </div>
    {#if mode === 'live' && ride.isFreeRide && ride.routeState && style?.next !== false}
      {@render note(
        t().ride.route.trainerDifficulty(
          Math.round(profile.difficulty * 100),
          formatNumber(ride.routeState.position.gradePct * profile.difficulty, 1),
        ),
      )}
    {/if}
  {:else if panel === 'map'}
    {@const r = mode === 'live' ? ride.route : route}
    {@const pos = mode === 'live' ? ride.routeState?.position : routePos}
    <div class="plot center" bind:clientWidth={w} bind:clientHeight={h}>
      {#if r && Math.min(w, h) > 20}
        <RouteMap route={r} position={pos} size={Math.floor(Math.min(w, h))} />
      {/if}
    </div>
  {:else if panel === 'world'}
    {#key ride.route?.id}<WorldView fill />{/key}
  {/if}
</div>

<style>
  .panel {
    background: var(--panel);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .panel.bare {
    padding: 0;
  }
  .plot {
    flex: 1;
    min-height: 0;
    min-width: 0;
  }
  .plot.center {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .next {
    margin: 0.35rem 0 0;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    text-align: center;
    color: var(--muted);
    border: 1px dashed color-mix(in srgb, var(--muted) 45%, transparent);
    border-radius: 6px;
  }
  .placeholder b {
    color: var(--fg);
  }
</style>
