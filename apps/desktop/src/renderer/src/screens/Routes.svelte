<script lang="ts">
  // E13-7/E13-9: route library and browser.
  import type { Route } from '@cyclotron/core'
  import RouteMap from '../components/RouteMap.svelte'
  import RouteProfile from '../components/RouteProfile.svelte'
  import { formatKm } from '../lib/format'
  import { go } from '../nav.svelte'
  import { ride } from '../ride/session.svelte'
  import { routeLibrary } from '../routes/library.svelte'
  import { library } from '../workouts/library.svelte'

  let error = $state<string | undefined>()

  $effect(() => {
    routeLibrary.load().catch((e: unknown) => (error = `Couldn't load your routes: ${String(e)}`))
    library.load().catch(() => {})
  })

  // Filters (E13-9). Ranges are [min, max) in the route's own units.
  const DISTANCE = [
    { label: 'Any distance', min: 0, max: Infinity },
    { label: 'Under 20 km', min: 0, max: 20_000 },
    { label: '20–50 km', min: 20_000, max: 50_000 },
    { label: 'Over 50 km', min: 50_000, max: Infinity },
  ]
  const CLIMBING = [
    { label: 'Any climbing', min: 0, max: Infinity },
    { label: 'Under 500 m', min: 0, max: 500 },
    { label: '500–1500 m', min: 500, max: 1500 },
    { label: 'Over 1500 m', min: 1500, max: Infinity },
  ]
  const GRADE = [
    { label: 'Any grade', min: -Infinity, max: Infinity },
    { label: 'Flat to rolling (avg < 3 %)', min: -Infinity, max: 3 },
    { label: 'Climb (avg 3–6 %)', min: 3, max: 6 },
    { label: 'Steep climb (avg ≥ 6 %)', min: 6, max: Infinity },
  ]

  let search = $state('')
  let distance = $state(0)
  let climbing = $state(0)
  let grade = $state(0)
  let favouritesOnly = $state(false)
  /** Workout chosen per route card; '' = free ride following the grade. */
  let workoutFor = $state<Record<string, string>>({})

  const inRange = (v: number, r: { min: number; max: number }): boolean => v >= r.min && v < r.max

  const shown = $derived(
    routeLibrary.all
      .filter(
        (r) =>
          r.name.toLowerCase().includes(search.trim().toLowerCase()) &&
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

  function rideRoute(route: Route): void {
    const workoutId = workoutFor[route.id] ?? ''
    const workout = workoutId ? library.all.find((w) => w.id === workoutId) : undefined
    if (ride.loadRoute(route, workout)) go('ride')
    else error = 'Finish or end the current ride first.'
  }

  async function importGpx(): Promise<void> {
    error = undefined
    try {
      await routeLibrary.importGpx()
    } catch (e) {
      error = `Import failed: ${e instanceof Error ? e.message : String(e)}`
    }
  }
</script>

<div class="head">
  <h1>Routes</h1>
  <button onclick={importGpx}>Import GPX…</button>
</div>
<p class="muted">
  Ride a real road: the trainer follows the grade and the ride is saved as a virtual ride with GPS.
  Imported routes stay in your library.
</p>

{#if error}<p class="error">{error}</p>{/if}
{#each routeLibrary.messages as m (m)}<p class="muted">{m}</p>{/each}

<div class="filters">
  <input type="search" placeholder="Search" bind:value={search} aria-label="Search routes" />
  <select bind:value={distance} aria-label="Distance">
    {#each DISTANCE as o, i (i)}<option value={i}>{o.label}</option>{/each}
  </select>
  <select bind:value={climbing} aria-label="Climbing">
    {#each CLIMBING as o, i (i)}<option value={i}>{o.label}</option>{/each}
  </select>
  <select bind:value={grade} aria-label="Average grade">
    {#each GRADE as o, i (i)}<option value={i}>{o.label}</option>{/each}
  </select>
  <label><input type="checkbox" bind:checked={favouritesOnly} /> Favourites</label>
</div>

{#if shown.length === 0}
  <p class="muted">No routes match these filters.</p>
{/if}

<div class="list">
  {#each shown as route (route.id)}
    {@const fav = routeLibrary.isFavourite(route.id)}
    <article class="card">
      <div class="title">
        <h2>{route.name}</h2>
        <button
          class="star"
          class:on={fav}
          onclick={() => routeLibrary.toggleFavourite(route.id)}
          title={fav ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed={fav}>{fav ? '★' : '☆'}</button
        >
      </div>
      <p class="stats">
        {formatKm(route.distanceM)} · {route.ascentM} m climbing · avg {route.avgGradePct.toFixed(
          1,
        )} % · max {route.maxGradePct.toFixed(1)} %{route.loop ? ' · loop' : ''}
      </p>
      <div class="shape">
        <div class="profile"><RouteProfile {route} height={70} /></div>
        <RouteMap {route} size={90} />
      </div>
      {#if route.description}<p class="muted desc">{route.description}</p>{/if}
      <div class="actions">
        <button onclick={() => rideRoute(route)}>Ride</button>
        <select
          value={workoutFor[route.id] ?? ''}
          onchange={(e) =>
            (workoutFor = {
              ...workoutFor,
              [route.id]: (e.currentTarget as HTMLSelectElement).value,
            })}
          aria-label="Workout on this route"
        >
          <option value="">Follow the road (grade)</option>
          {#each library.all as w (w.id)}<option value={w.id}>Workout: {w.name}</option>{/each}
        </select>
        {#if route.source === 'gpx'}
          <button class="quiet" onclick={() => routeLibrary.remove(route.id)}>Delete</button>
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
  .actions select {
    min-width: 0;
    flex: 1;
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
