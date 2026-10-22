<script lang="ts">
  // E13-7/E13-9: route library and browser.
  import type { Route, Workout } from '@cyclotron/core'
  import RouteMap from '../components/RouteMap.svelte'
  import RouteProfile from '../components/RouteProfile.svelte'
  import WorkoutPicker from '../components/WorkoutPicker.svelte'
  import { routeDescription, routeName } from '../i18n/content'
  import { errorText } from '../i18n/errors'
  import { formatNumber } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { formatKm } from '../lib/format'
  import { go } from '../nav.svelte'
  import { ride } from '../ride/session.svelte'
  import { routeLibrary } from '../routes/library.svelte'

  let error = $state<string | undefined>()

  $effect(() => {
    routeLibrary.load().catch((e: unknown) => (error = t().library.routes.loadFailed(String(e))))
  })

  // Filters (E13-9). Ranges are [min, max) in the route's own units; labels come from
  // t().library.routes.distances / climbs / grades by index.
  const DISTANCE = [
    { min: 0, max: Infinity },
    { min: 0, max: 20_000 },
    { min: 20_000, max: 50_000 },
    { min: 50_000, max: Infinity },
  ]
  const CLIMBING = [
    { min: 0, max: Infinity },
    { min: 0, max: 500 },
    { min: 500, max: 1500 },
    { min: 1500, max: Infinity },
  ]
  const GRADE = [
    { min: -Infinity, max: Infinity },
    { min: -Infinity, max: 3 },
    { min: 3, max: 6 },
    { min: 6, max: Infinity },
  ]

  let search = $state('')
  let distance = $state(0)
  let climbing = $state(0)
  let grade = $state(0)
  let favouritesOnly = $state(false)
  /** Route waiting for a workout choice. */
  let picking = $state<Route | undefined>()

  const inRange = (v: number, r: { min: number; max: number }): boolean => v >= r.min && v < r.max

  const shown = $derived(
    routeLibrary.all
      .filter(
        (r) =>
          routeName(r).toLowerCase().includes(search.trim().toLowerCase()) &&
          inRange(r.distanceM, DISTANCE[distance]!) &&
          inRange(r.ascentM, CLIMBING[climbing]!) &&
          inRange(r.avgGradePct, GRADE[grade]!) &&
          (!favouritesOnly || routeLibrary.isFavourite(r.id)),
      )
      // Favourites first, otherwise keep library order (built-ins, then imports).
      .sort(
        (a, b) => Number(routeLibrary.isFavourite(b.id)) - Number(routeLibrary.isFavourite(a.id)),
      ),
  )

  function rideRoute(route: Route, workout: Workout | undefined): void {
    picking = undefined
    if (ride.loadRoute(route, workout)) go('ride')
    else error = t().library.routes.rideBusy
  }

  async function importGpx(): Promise<void> {
    error = undefined
    try {
      await routeLibrary.importGpx()
    } catch (e) {
      error = t().library.routes.importFailed(errorText(e))
    }
  }
</script>

<div class="head">
  <h1>{t().library.routes.title}</h1>
  <button onclick={importGpx}>{t().library.routes.importGpx}</button>
</div>
<p class="muted">{t().library.routes.intro}</p>

{#if error}<p class="error">{error}</p>{/if}
{#each routeLibrary.messages as m (m)}<p class="muted">{m}</p>{/each}

{#if picking}
  {@const route = picking}
  <WorkoutPicker
    title={routeName(route)}
    onpick={(workout) => rideRoute(route, workout)}
    oncancel={() => (picking = undefined)}
  />
{/if}

<div class="filters">
  <input
    type="search"
    placeholder={t().common.actions.search}
    bind:value={search}
    aria-label={t().library.routes.searchLabel}
  />
  <select bind:value={distance} aria-label={t().library.routes.distance}>
    {#each t().library.routes.distances as label, i (i)}<option value={i}>{label}</option>{/each}
  </select>
  <select bind:value={climbing} aria-label={t().library.routes.climbing}>
    {#each t().library.routes.climbs as label, i (i)}<option value={i}>{label}</option>{/each}
  </select>
  <select bind:value={grade} aria-label={t().library.routes.avgGrade}>
    {#each t().library.routes.grades as label, i (i)}<option value={i}>{label}</option>{/each}
  </select>
  <label><input type="checkbox" bind:checked={favouritesOnly} /> {t().common.favourites}</label>
</div>

{#if shown.length === 0}
  <p class="muted">{t().library.routes.noMatch}</p>
{/if}

<div class="list">
  {#each shown as route (route.id)}
    {@const fav = routeLibrary.isFavourite(route.id)}
    <article class="card">
      <div class="title">
        <h2>{routeName(route)}</h2>
        <button
          class="star"
          class:on={fav}
          onclick={() => routeLibrary.toggleFavourite(route.id)}
          title={fav ? t().common.actions.removeFavourite : t().common.actions.addFavourite}
          aria-pressed={fav}>{fav ? '★' : '☆'}</button
        >
      </div>
      <p class="stats">
        {formatKm(route.distanceM)} · {t().library.routes.climbingM(route.ascentM)} · {t().library.routes.avg(
          formatNumber(route.avgGradePct, 1),
        )} · {t().library.routes.max(formatNumber(route.maxGradePct, 1))}{route.loop
          ? ` · ${t().library.routes.loop}`
          : ''}
      </p>
      <div class="shape">
        <div class="profile"><RouteProfile {route} height={70} /></div>
        <RouteMap {route} size={90} />
      </div>
      {#if routeDescription(route)}<p class="muted desc">{routeDescription(route)}</p>{/if}
      <div class="actions">
        <button onclick={() => (picking = route)}>{t().common.actions.ride}</button>
        {#if route.source === 'gpx'}
          <button class="quiet" onclick={() => routeLibrary.remove(route.id)}
            >{t().common.actions.delete}</button
          >
        {/if}
      </div>
      {#if route.attribution}<p class="credit">{route.attribution}</p>{/if}
    </article>
  {/each}
</div>

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .head h1 {
    margin: 0;
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .filters input[type='search'] {
    width: 12rem;
  }
  .list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
    gap: 0.75rem;
  }
  .list .card {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .title h2 {
    margin: 0;
  }
  .star {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: var(--muted);
    padding: 0 0.25rem;
  }
  .star.on {
    color: var(--warn);
  }
  .stats,
  .desc {
    margin: 0;
  }
  .desc {
    font-size: 0.9rem;
    flex: 1;
  }
  .shape {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
  }
  .profile {
    flex: 1;
    min-width: 0;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .quiet {
    margin-left: auto;
  }
  .credit {
    margin: 0;
    font-size: 0.7rem;
    color: var(--muted);
  }
</style>
