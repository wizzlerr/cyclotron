<script lang="ts">
  // E3-8: one step in the workout builder. Repeats contain their own rows.
  import { newStep, parseDuration, type WorkoutStep } from '@cyclotron/core'
  import { t } from '../i18n/t'
  import { formatDuration } from '../lib/format'
  import StepRow from './StepRow.svelte'

  let {
    steps,
    index,
    ftpW,
    nested = false,
  }: { steps: WorkoutStep[]; index: number; ftpW: number; nested?: boolean } = $props()

  const step = $derived(steps[index]!)

  const KINDS = ['steady', 'ramp', 'freeride', 'maxeffort'] as const
  type Kind = (typeof KINDS)[number]

  /** Turns a step into another kind, keeping its duration and power where that makes sense. */
  function changeKind(kind: Kind): void {
    const s = step
    if (s.kind === 'repeat' || s.kind === kind) return
    const durationS = s.durationS
    const pct = s.kind === 'steady' ? s.pct : s.kind === 'ramp' ? s.toPct : 0.75
    steps[index] =
      kind === 'steady'
        ? { kind, durationS, pct }
        : kind === 'ramp'
          ? { kind, durationS, fromPct: Math.round(pct * 80) / 100, toPct: pct }
          : { kind, durationS }
  }

  function setDuration(e: Event & { currentTarget: HTMLInputElement }): void {
    const s = step
    if (s.kind === 'repeat') return
    const v = parseDuration(e.currentTarget.value)
    if (v !== undefined && v > 0) s.durationS = v
    // Show the normalised value, or put the old one back if it wasn't a duration.
    e.currentTarget.value = formatDuration(s.durationS)
  }

  /** % of FTP field → fraction; blank or nonsense keeps the old value. */
  function pctFrom(e: Event & { currentTarget: HTMLInputElement }, old: number): number {
    const v = e.currentTarget.valueAsNumber
    const pct = Number.isFinite(v) && v >= 0 && v <= 300 ? Math.round(v) / 100 : old
    e.currentTarget.value = String(Math.round(pct * 100))
    return pct
  }

  function setCadence(e: Event & { currentTarget: HTMLInputElement }): void {
    const s = step
    if (s.kind !== 'steady' && s.kind !== 'ramp') return
    const v = e.currentTarget.valueAsNumber
    if (Number.isFinite(v) && v >= 30 && v <= 150) s.cadence = Math.round(v)
    else delete s.cadence
  }

  function move(delta: number): void {
    const j = index + delta
    if (j < 0 || j >= steps.length) return
    ;[steps[index], steps[j]] = [steps[j]!, steps[index]!]
  }

  function duplicate(): void {
    steps.splice(index + 1, 0, structuredClone($state.snapshot(step)) as WorkoutStep)
  }

  const watts = (pct: number): number => Math.round(pct * ftpW)
  const pctValue = (pct: number): number => Math.round(pct * 100)
</script>

<li class="step" class:repeat={step.kind === 'repeat'}>
  {#if step.kind === 'repeat'}
    {@const rep = step}
    <div class="row">
      <span class="kind">{t().library.step.repeat}</span>
      <label class="field">
        <input
          type="number"
          min="1"
          max="50"
          value={rep.count}
          onchange={(e) => {
            const v = e.currentTarget.valueAsNumber
            if (Number.isInteger(v) && v >= 1 && v <= 50) rep.count = v
            else e.currentTarget.value = String(rep.count)
          }}
          aria-label={t().library.step.timesLabel}
        />
        {t().library.step.times}
      </label>
      {@render actions()}
    </div>
    <ol class="inner">
      {#each rep.steps, i (i)}
        <StepRow steps={rep.steps} index={i} {ftpW} nested />
      {/each}
    </ol>
    <div class="add-inner">
      <button onclick={() => rep.steps.push(newStep('steady'))}
        >{t().library.step.stepInRepeat}</button
      >
    </div>
  {:else}
    {@const s = step}
    <div class="row">
      <select
        class="kind"
        value={s.kind}
        onchange={(e) => changeKind(e.currentTarget.value as Kind)}
        aria-label={t().library.step.stepType}
      >
        {#each KINDS as k (k)}<option value={k}>{t().common.segments[k]}</option>{/each}
      </select>

      <input
        class="duration"
        value={formatDuration(s.durationS)}
        onchange={setDuration}
        aria-label={t().library.step.duration}
        title={t().library.step.durationHint}
      />

      {#if s.kind === 'steady'}
        <span class="field">
          <input
            type="number"
            min="0"
            max="300"
            value={pctValue(s.pct)}
            onchange={(e) => (s.pct = pctFrom(e, s.pct))}
            aria-label={t().library.step.power}
          />
          % FTP <span class="muted">{watts(s.pct)} W</span>
        </span>
      {:else if s.kind === 'ramp'}
        <span class="field">
          <input
            type="number"
            min="0"
            max="300"
            value={pctValue(s.fromPct)}
            onchange={(e) => (s.fromPct = pctFrom(e, s.fromPct))}
            aria-label={t().library.step.startPower}
          />
          →
          <input
            type="number"
            min="0"
            max="300"
            value={pctValue(s.toPct)}
            onchange={(e) => (s.toPct = pctFrom(e, s.toPct))}
            aria-label={t().library.step.endPower}
          />
          % FTP <span class="muted">{watts(s.fromPct)}–{watts(s.toPct)} W</span>
        </span>
      {:else if s.kind === 'freeride'}
        <span class="muted hint">{t().library.step.freerideHint}</span>
      {:else}
        <span class="muted hint">{t().library.step.maxeffortHint}</span>
      {/if}

      {#if s.kind === 'steady' || s.kind === 'ramp'}
        <span class="field">
          <input
            type="number"
            min="30"
            max="150"
            placeholder="–"
            value={s.cadence ?? ''}
            onchange={setCadence}
            aria-label={t().library.step.cadence}
          />
          rpm
        </span>
      {/if}
      {@render actions()}
    </div>
  {/if}
</li>

{#snippet actions()}
  <span class="actions">
    <button
      onclick={() => move(-1)}
      disabled={index === 0}
      title={t().library.step.moveUp}
      aria-label={t().library.step.moveUp}
    >
      ↑
    </button>
    <button
      onclick={() => move(1)}
      disabled={index === steps.length - 1}
      title={t().library.step.moveDown}
      aria-label={t().library.step.moveDown}
    >
      ↓
    </button>
    <button
      onclick={duplicate}
      title={t().common.actions.duplicate}
      aria-label={t().common.actions.duplicate}>⧉</button
    >
    <button
      onclick={() => steps.splice(index, 1)}
      disabled={nested && steps.length === 1}
      title={t().common.actions.delete}
      aria-label={t().common.actions.delete}
    >
      ✕
    </button>
  </span>
{/snippet}

<style>
  .step {
    list-style: none;
    background: var(--bg);
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
  }
  .step.repeat {
    border-left: 3px solid var(--series-1);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
  }
  .kind {
    width: 7.5rem;
    font-weight: 600;
  }
  .field {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .field input {
    width: 4.5rem;
  }
  .duration {
    width: 5rem;
  }
  .hint {
    font-size: 0.9rem;
  }
  .actions {
    margin-left: auto;
    display: inline-flex;
    gap: 0.25rem;
  }
  .actions button {
    min-width: 2rem;
  }
  .inner {
    margin: 0.4rem 0 0 1rem;
    padding: 0;
    display: grid;
    gap: 0.3rem;
  }
  .add-inner {
    margin: 0.4rem 0 0 1rem;
  }
</style>
