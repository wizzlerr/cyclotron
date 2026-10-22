<script lang="ts">
  // Choose where to ride a workout (E13-8): a route for the scenery, or none (ERG only).
  import type { Route } from '@cyclotron/core'
  import { routeName } from '../i18n/content'
  import { formatNumber } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { formatKm } from '../lib/format'
  import { routeLibrary } from '../routes/library.svelte'
  import PickerDialog from './PickerDialog.svelte'
  import RouteMap from './RouteMap.svelte'
  import RouteProfile from './RouteProfile.svelte'

  let {
    title,
    onpick,
    oncancel,
  }: {
    title: string
    /** `undefined` = no route. */
    onpick: (route: Route | undefined) => void
    oncancel: () => void
  } = $props()

  let search = $state('')
  let searchBox = $state<HTMLInputElement>()

  $effect(() => {
    routeLibrary.load().catch(() => {})
    searchBox?.focus()
  })

  const shown = $derived(
    routeLibrary.all
      .filter((r) => routeName(r).toLowerCase().includes(search.trim().toLowerCase()))
      .sort(
        (a, b) => Number(routeLibrary.isFavourite(b.id)) - Number(routeLibrary.isFavourite(a.id)),
      ),
  )
</script>

<PickerDialog
  heading={t().library.pickers.routeHeading}
  subtitle={t().library.pickers.routeSubtitle(title)}
  {oncancel}
>
  {#snippet controls()}
    <input
      type="search"
      placeholder={t().library.routes.searchLabel}
      bind:value={search}
      bind:this={searchBox}
      aria-label={t().library.routes.searchLabel}
    />
  {/snippet}

  {#if !search.trim()}
    <button class="tile none" onclick={() => onpick(undefined)}>
      <span class="name">{t().library.pickers.noRoute}</span>
      <span class="muted">{t().library.pickers.noRouteHint}</span>
    </button>
  {/if}
  {#each shown as route (route.id)}
    <button class="tile" onclick={() => onpick(route)}>
      <span class="name">
        {#if routeLibrary.isFavourite(route.id)}<span class="star">★</span>{/if}
        {routeName(route)}
      </span>
      <span class="stats">
        {formatKm(route.distanceM)} · {route.ascentM} m · {t().library.routes.avg(
          formatNumber(route.avgGradePct, 1),
        )} · {t().library.routes.max(formatNumber(route.maxGradePct, 1))}{route.loop
          ? ` · ${t().library.routes.loop}`
          : ''}
      </span>
      <span class="shape">
        <span class="profile"><RouteProfile {route} height={56} /></span>
        <RouteMap {route} size={64} />
      </span>
    </button>
  {:else}
    <p class="muted">{t().library.pickers.noRoutes}</p>
  {/each}
</PickerDialog>

<style>
  .shape {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
  }
  .profile {
    flex: 1;
    min-width: 0;
  }
</style>
