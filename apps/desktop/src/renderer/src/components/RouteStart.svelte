<script lang="ts">
  // Where and which way to ride a route: forward or reverse, from the start or part-way along.
  import { MIN_VARIANT_M, routeVariant, type Route, type RouteVariant } from '@cyclotron/core'
  import { t } from '../i18n/t'
  import { formatKm } from '../lib/format'
  import RouteMap from './RouteMap.svelte'
  import RouteProfile from './RouteProfile.svelte'

  let {
    route,
    variant = $bindable({ reverse: false, startM: 0 }),
  }: { route: Route; variant?: RouteVariant } = $props()

  /** Start points snap to this many metres. */
  const SNAP_M = 100

  /** The whole road in the chosen direction; the start marker sits on it. */
  const directed = $derived(routeVariant(route, { reverse: variant.reverse, startM: 0 }))
  const maxStartM = $derived(
    Math.max(0, Math.floor((route.distanceM - MIN_VARIANT_M) / SNAP_M) * SNAP_M),
  )
  const ridden = $derived(routeVariant(route, variant))
  /** Distance under the cursor on the profile, shown on the map too. */
  let hoverM = $state<number | undefined>()

  function setStart(m: number): void {
    const startM = Math.min(maxStartM, Math.max(0, Math.round(m / SNAP_M) * SNAP_M))
    variant = { ...variant, startM }
  }

  /** Distances are counted in the riding direction, so a new direction starts from its start. */
  function setReverse(reverse: boolean): void {
    if (reverse !== variant.reverse) variant = { reverse, startM: 0 }
  }

  function onProfileClick(e: MouseEvent): void {
    const rect = (e.currentTarget as Element).getBoundingClientRect()
    setStart(((e.clientX - rect.left) / rect.width) * directed.distanceM)
  }
</script>

<div class="route-start">
  <div class="row">
    <div class="seg" role="group" aria-label={t().library.routeStart.direction}>
      <button
        class:on={!variant.reverse}
        aria-pressed={!variant.reverse}
        onclick={() => setReverse(false)}>{t().library.routeStart.forward}</button
      >
      <button
        class:on={variant.reverse}
        aria-pressed={variant.reverse}
        onclick={() => setReverse(true)}>{t().library.routeStart.reverse}</button
      >
    </div>
    <label class="start">
      {t().library.routeStart.startAt}
      <input
        type="number"
        min="0"
        max={maxStartM / 1000}
        step={SNAP_M / 1000}
        value={variant.startM / 1000}
        onchange={(e) => setStart(Number(e.currentTarget.value) * 1000)}
        aria-label={t().library.routeStart.startLabel}
      />
      km
    </label>
    {#if variant.startM > 0}
      <button class="link" onclick={() => setStart(0)}>{t().library.routeStart.fromStart}</button>
    {/if}
    <span class="muted summary"
      >{t().library.routeStart.summary(formatKm(ridden.distanceM), ridden.ascentM)}</span
    >
  </div>

  <div class="body">
    <div class="track">
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="profile" onclick={onProfileClick}>
        <RouteProfile
          route={directed}
          positionM={variant.startM}
          height={80}
          onhover={(d) => (hoverM = d)}
        />
      </div>
      <input
        class="slider"
        type="range"
        min="0"
        max={directed.distanceM}
        step={SNAP_M}
        value={variant.startM}
        oninput={(e) => setStart(Number(e.currentTarget.value))}
        aria-label={t().library.routeStart.startLabel}
      />
      <p class="muted hint">
        {t().library.routeStart.hint}{route.loop ? ` ${t().library.routeStart.loopHint}` : ''}
      </p>
    </div>
    <RouteMap route={directed} fromM={variant.startM} {hoverM} size={160} onpick={setStart} />
  </div>
</div>

<style>
  .route-start {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.75rem;
    background: var(--bg);
    border: 1px solid var(--grid);
    border-radius: 6px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  .seg {
    display: inline-flex;
  }
  .seg button {
    border-radius: 0;
  }
  .seg button:first-child {
    border-radius: 4px 0 0 4px;
  }
  .seg button:last-child {
    border-radius: 0 4px 4px 0;
  }
  .seg button.on {
    background: var(--series-1);
    color: var(--bg);
  }
  .start {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .start input {
    width: 5.5rem;
  }
  .link {
    background: none;
    border: none;
    color: var(--series-1);
    padding: 0;
  }
  .summary {
    margin-left: auto;
  }
  .body {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .track {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .profile {
    cursor: pointer;
  }
  .slider {
    width: 100%;
    margin: 0;
  }
  .hint {
    margin: 0;
    font-size: 0.8rem;
  }
</style>
