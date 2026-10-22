<script lang="ts">
  // "What should I ride today?" (E11-6): one recommendation, an easier and a shorter one, and why.
  import { buildTimeline, type Pick, type Reason, type Route, type Workout } from '@cyclotron/core'
  import { workoutDescription, workoutName } from '../i18n/content'
  import { formatNumber } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { formatDuration } from '../lib/format'
  import { go } from '../nav.svelte'
  import { profile } from '../profile.svelte'
  import { today } from '../reco/today.svelte'
  import { ride } from '../ride/session.svelte'
  import { library } from '../workouts/library.svelte'
  import RoutePicker from './RoutePicker.svelte'
  import WorkoutProfile from './WorkoutProfile.svelte'

  const TIMES = [30, 45, 60, 75, 90, 120, 150]

  $effect(() => {
    void today.refresh()
  })

  const r = $derived(today.result)
  const tr = $derived(t().reco)
  const typeName = (type: Pick['type']): string => t().common.workoutTypes[type]
  const signed = (n: number): string => {
    const v = Math.round(n) || 0 // no "-0"
    return (v > 0 ? '+' : '') + formatNumber(v)
  }

  function reasonText(reason: Reason): string | undefined {
    const w = tr.reasons
    switch (reason.code) {
      case 'readiness':
        return w.readiness(reason.readiness, signed(reason.tsb))
      case 'hardYesterday':
      case 'twoHardDays':
      case 'recentFail':
      case 'restDay':
        return w[reason.code]
      case 'signal':
        return w.signal(reason.source, reason.shift)
      case 'goal':
        return w.goal(reason.goal, typeName(reason.type))
      case 'tooMuchIntensity':
      case 'roomForIntensity':
        return w[reason.code](reason.highPct)
      case 'notDoneFor':
        return w.notDoneFor(typeName(reason.type), reason.days)
      case 'weeklyDone':
        return w.weeklyDone(formatNumber(reason.hours, 1), formatNumber(reason.target))
      case 'level':
        return w.level(
          typeName(reason.type),
          formatNumber(reason.level, 1),
          formatNumber(reason.difficulty, 1),
        )
      case 'noFit':
        return undefined
    }
  }
  const reasons = $derived(
    (r?.reasons ?? []).map(reasonText).filter((s): s is string => s !== undefined),
  )

  /** Workout waiting for a route choice. */
  let picking = $state<Workout | undefined>()

  function start(w: Workout, route: Route | undefined): void {
    picking = undefined
    if (route ? ride.loadRoute(route, w) : ride.load(w)) go('ride')
  }

  const readinessClass = $derived(
    r ? { fresh: 'ok', normal: 'info', fatigued: 'warn', very_fatigued: 'bad' }[r.readiness] : '',
  )
</script>

{#snippet option(label: string, pick: Pick, big: boolean)}
  {@const w = pick.generated ?? library.find(pick.id)}
  {#if w}
    <div class="option" class:big>
      <div class="option-head">
        <span class="label"
          >{label}{#if pick.generated}<span class="made">{tr.generated.badge}</span>{/if}</span
        >
        <span class="meta">
          {typeName(pick.type)} · {t().common.level(formatNumber(pick.difficulty, 1))} · {formatDuration(
            pick.durationS,
          )}
        </span>
      </div>
      <div class="option-body">
        <span class="name">{workoutName(w)}</span>
        <button class:primary={big} onclick={() => (picking = w)}>{t().common.actions.ride}</button>
      </div>
      {#if big && pick.generated}
        <p class="desc">{workoutDescription(w)}</p>
      {/if}
      {#if big}
        <WorkoutProfile timeline={buildTimeline(w.steps)} ftpW={profile.ftpW} height={56} />
      {/if}
    </div>
  {/if}
{/snippet}

<section class="card today">
  <div class="head">
    <h2>{tr.today}</h2>
    {#if r}
      <span class="chip {readinessClass}">
        {tr.readiness[r.readiness]} · {tr.form(signed(r.tsb))}
      </span>
    {/if}
  </div>

  <div class="times" role="group" aria-label={tr.timeLabel}>
    <span class="muted">{tr.timeLabel}</span>
    {#each TIMES as m (m)}
      <button
        class="time"
        class:on={today.minutes === m}
        aria-pressed={today.minutes === m}
        onclick={() => (today.minutes = m)}>{tr.minutes(m)}</button
      >
    {/each}
  </div>

  {#if today.error}
    <p class="error">{tr.failed(today.error)}</p>
  {:else if !r}
    <p class="muted">{tr.loading}</p>
  {:else}
    {#if r.rest}
      <p class="rest"><strong>{tr.restTitle}.</strong> {tr.restRide}</p>
    {/if}
    {#if r.main}
      {@render option(tr.recommended, r.main, true)}
      {#if r.easier}{@render option(tr.easier, r.easier, false)}{/if}
      {#if r.shorter}{@render option(tr.shorter, r.shorter, false)}{/if}
    {:else}
      <p class="muted">{tr.nothing}</p>
    {/if}
    {#if reasons.length > 0}
      <h3>{tr.why}</h3>
      <ul class="why">
        {#each reasons as line (line)}<li>{line}</li>{/each}
      </ul>
    {/if}
  {/if}
</section>

{#if picking}
  {@const w = picking}
  <RoutePicker
    title={workoutName(w)}
    onpick={(route) => start(w, route)}
    oncancel={() => (picking = undefined)}
  />
{/if}

<style>
  .today {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .head h2 {
    margin: 0;
  }
  .chip {
    font-size: 0.8rem;
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    border: 1px solid currentColor;
    color: var(--muted);
  }
  .chip.ok {
    color: var(--ok);
  }
  .chip.info {
    color: var(--series-1);
  }
  .chip.warn {
    color: var(--warn);
  }
  .chip.bad {
    color: var(--error);
  }
  .times {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
  }
  .times .muted {
    margin-right: 0.25rem;
    font-size: 0.85rem;
  }
  .time {
    padding: 0.1rem 0.5rem;
    font-size: 0.85rem;
  }
  .time.on {
    outline: 2px solid var(--series-1);
  }
  .option {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--grid);
    border-radius: 6px;
  }
  .option.big {
    background: var(--bg);
  }
  .option-head {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--muted);
  }
  .label {
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .option-body {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .name {
    font-weight: 600;
  }
  .big .name {
    font-size: 1.15rem;
  }
  .rest {
    margin: 0;
  }
  .made {
    margin-left: 0.5rem;
    padding: 0 0.4rem;
    border: 1px solid var(--series-1);
    border-radius: 999px;
    color: var(--fg);
  }
  .desc {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted);
  }
  h3 {
    font-size: 0.85rem;
    margin: 0.25rem 0 0;
    color: var(--muted);
  }
  .why {
    margin: 0;
    padding-left: 1.1rem;
    font-size: 0.9rem;
  }
  .error {
    color: var(--error);
  }
</style>
