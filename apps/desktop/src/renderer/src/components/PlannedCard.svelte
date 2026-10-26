<script lang="ts">
  // Home → rides planned on the intervals.icu calendar (E18). Hidden until intervals.icu is connected.
  import {
    buildTimeline,
    localDate,
    timelineDurationS,
    type Route,
    type Workout,
  } from '@cyclotron/core'
  import { formatDate, formatDateTime } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { formatDuration } from '../lib/format'
  import { go } from '../nav.svelte'
  import { profile } from '../profile.svelte'
  import { ride } from '../ride/session.svelte'
  import { planned } from '../workouts/planned.svelte'
  import RoutePicker from './RoutePicker.svelte'
  import WorkoutProfile from './WorkoutProfile.svelte'

  const it = $derived(t().intervals)
  const p = $derived(it.planned)
  /** The next planned day gets its profile drawn. */
  const nextDate = $derived(planned.upcoming[0]?.date)
  const todayDate = localDate(Date.now(), -new Date().getTimezoneOffset())

  $effect(() => {
    void planned.refresh('auto')
  })

  let picking = $state<Workout | undefined>()

  function start(w: Workout, route: Route | undefined): void {
    picking = undefined
    if (route ? ride.loadRoute(route, w) : ride.load(w)) go('ride')
  }
</script>

{#if planned.status?.connected}
  <section class="card planned">
    <div class="head">
      <h2>{p.title}</h2>
      <div class="actions">
        <button class="small" disabled={planned.busy} onclick={() => planned.refresh('force')}
          >{p.refresh}</button
        >
        <button class="small" onclick={() => window.cyclotron.intervals.openCalendar()}
          >{p.calendar}</button
        >
      </div>
    </div>
    {#if planned.status.error}
      <p class="error">{it.errors[planned.status.error]}</p>
    {/if}
    {#if planned.upcoming.length === 0}
      <p class="muted">{p.empty}</p>
    {:else}
      <ul>
        {#each planned.upcoming as r (r.eventId)}
          {@const timeline = buildTimeline(r.workout.steps)}
          <li>
            <div class="line">
              <span class="when">
                {formatDate(Date.parse(`${r.date}T12:00:00`), {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
                {#if r.date === todayDate}<span class="tag">{p.today}</span>{/if}
              </span>
              <span class="name">{r.workout.name}</span>
              <span class="muted">
                {formatDuration(timelineDurationS(timeline))}{#if r.loadTss}
                  · {p.load(r.loadTss)}{/if}
              </span>
              {#if r.done}<span class="done">✓ {p.done}</span>{/if}
              <button
                class:primary={r.date === todayDate && !r.done}
                onclick={() => (picking = r.workout)}>{t().common.actions.ride}</button
              >
            </div>
            {#if r.date === nextDate}
              <WorkoutProfile {timeline} ftpW={profile.ftpW} height={48} />
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
    {#if planned.status.plannedAt}
      <p class="muted small">{p.fetched(formatDateTime(planned.status.plannedAt))}</p>
    {/if}
  </section>
{/if}

{#if picking}
  {@const w = picking}
  <RoutePicker
    title={w.name}
    onpick={(route) => start(w, route)}
    oncancel={() => (picking = undefined)}
  />
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .head h2 {
    margin: 0;
  }
  .actions {
    display: flex;
    gap: 0.4rem;
  }
  button.small {
    font-size: 0.8rem;
    padding: 0.2rem 0.6rem;
  }
  ul {
    list-style: none;
    margin: 0.6rem 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  li {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.75rem;
  }
  .when {
    min-width: 7rem;
    color: var(--muted);
  }
  .name {
    font-weight: 600;
    flex: 1;
    min-width: 8rem;
  }
  .tag {
    font-size: 0.75rem;
    margin-left: 0.3rem;
    padding: 0 0.4rem;
    border-radius: 999px;
    border: 1px solid currentColor;
    color: var(--series-1);
  }
  .done {
    color: var(--ok);
    font-size: 0.85rem;
  }
  p.small {
    font-size: 0.8rem;
    margin: 0.5rem 0 0;
  }
  .error {
    color: var(--error);
  }
</style>
