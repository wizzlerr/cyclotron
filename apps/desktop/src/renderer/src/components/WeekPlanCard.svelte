<script lang="ts">
  // This week's plan (E11-9): what each day is for, and what was ridden.
  import type { PlanDay } from '@cyclotron/core'
  import { formatDate } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { go } from '../nav.svelte'
  import { today } from '../reco/today.svelte'

  const tr = $derived(t().reco)
  const plan = $derived(today.plan)
  const todayDate = $derived(today.planToday?.date)

  const doneTss = (d: PlanDay): number => Math.round(d.rides.reduce((s, r) => s + r.tss, 0))
  const weekDone = $derived(plan ? plan.days.reduce((s, d) => s + doneTss(d), 0) : 0)

  function status(d: PlanDay): 'done' | 'missed' | 'extra' | undefined {
    if (d.rides.length > 0) return d.kind === 'rest' ? 'extra' : 'done'
    if (d.kind !== 'rest' && todayDate && d.date < todayDate) return 'missed'
    return undefined
  }
</script>

{#if plan}
  <section class="card week">
    <h2>{tr.plan.title}</h2>
    <ol class="days">
      {#each plan.days as d (d.date)}
        {@const st = status(d)}
        <li class="day {d.kind}" class:today={d.date === todayDate}>
          <span class="when">
            <b>{tr.settings.days[d.weekday]}</b>
            {formatDate(Date.parse(`${d.date}T12:00:00`), { day: 'numeric', month: 'short' })}
            {#if d.date === todayDate}<span class="tag">{tr.plan.todayTag}</span>{/if}
          </span>
          <span class="kind">{tr.plan.kinds[d.kind]}</span>
          {#if d.kind !== 'rest'}
            <span class="what"
              >{d.kind === 'hard' && d.type ? t().common.workoutTypes[d.type] : ''}</span
            >
            <span class="muted">{tr.minutes(d.minutes)}</span>
          {/if}
          {#if st}
            <span class="status {st}">
              {st === 'done'
                ? `✓ ${tr.plan.done}`
                : st === 'extra'
                  ? `✓ ${tr.plan.extra}`
                  : tr.plan.missed}
              {#if st !== 'missed'}· TSS {doneTss(d)}{/if}
            </span>
          {/if}
        </li>
      {/each}
    </ol>
    <p class="muted">{tr.plan.planned(plan.plannedTss, weekDone)}</p>
    {#if plan.capped}<p class="muted">{tr.plan.capped}</p>{/if}
    {#if plan.defaultDays}
      <p class="muted">
        {tr.plan.defaultDays}
        <button class="link" onclick={() => go('settings')}>{tr.plan.settings}</button>
      </p>
    {/if}
  </section>
{/if}

<style>
  .week {
    grid-column: 1 / -1;
  }
  .days {
    list-style: none;
    margin: 0 0 0.5rem;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
    gap: 0.5rem;
  }
  .day {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--grid);
    border-left: 4px solid var(--grid);
    border-radius: 6px;
    font-size: 0.9rem;
  }
  .day.hard {
    border-left-color: var(--series-2);
  }
  .day.easy,
  .day.long {
    border-left-color: var(--series-1);
  }
  .day.rest {
    color: var(--muted);
  }
  .day.today {
    background: var(--bg);
    outline: 2px solid var(--series-1);
  }
  .when {
    display: flex;
    gap: 0.35rem;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .tag {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--series-1);
  }
  .kind {
    font-weight: 600;
  }
  .what {
    min-height: 1.2em;
  }
  .status {
    font-size: 0.8rem;
  }
  .status.done,
  .status.extra {
    color: var(--ok);
  }
  .status.missed {
    color: var(--muted);
    font-style: italic;
  }
  .link {
    background: none;
    border: none;
    padding: 0;
    color: var(--series-1);
    text-decoration: underline;
    cursor: pointer;
  }
</style>
