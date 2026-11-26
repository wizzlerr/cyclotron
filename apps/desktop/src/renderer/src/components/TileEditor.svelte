<script lang="ts">
  // Editor for one Ride screen tile (E4-6): its numbers (each with its own colour), size,
  // alignment, colours, animation and lock. Changes apply live.
  import {
    GRID_COLUMNS,
    MAX_TILE_METRICS,
    MAX_TILE_ROWS,
    TILE_ALIGNS,
    TILE_ANIMATIONS,
    cleanPanelStyle,
    type MetricId,
    type PanelId,
    type PanelStyle,
    type TileAnimation,
    type TileSpec,
  } from '@cyclotron/core'
  import { t } from '../i18n/t'
  import { rideLayout } from '../ride/layout.svelte'

  let { tile }: { tile: TileSpec } = $props()

  const GROUPS: { id: 'power' | 'body' | 'time' | 'step' | 'route'; metrics: MetricId[] }[] = [
    {
      id: 'power',
      metrics: [
        'power3s',
        'power',
        'power10s',
        'target',
        'wkg',
        'intervalAvg',
        'avgPower',
        'maxPower',
        'np',
        'if',
        'tss',
        'kcal',
      ],
    },
    {
      id: 'body',
      metrics: ['hr', 'avgHr', 'maxHr', 'cadence', 'cadenceTarget', 'avgCadence', 'speed'],
    },
    { id: 'time', metrics: ['intervalLeft', 'elapsed', 'total', 'workoutLeft'] },
    { id: 'step', metrics: ['step', 'stepTarget', 'stepRepeat', 'nextStep'] },
    { id: 'route', metrics: ['grade', 'distance', 'toGo', 'elevation', 'climbed'] },
  ]

  /** Quick picks; any colour is possible with the colour field. */
  const SWATCHES = [
    '#3987e5',
    '#2e9e5b',
    '#d4a017',
    '#e8702a',
    '#d64545',
    '#9b59b6',
    '#16a3a3',
    '#ffffff',
    '#0b0e12',
  ]

  const L = $derived(t().ride.layout)
  const names = $derived(t().ride.metrics)

  const set = (patch: Partial<Omit<TileSpec, 'key' | 'x' | 'y' | 'w' | 'h'>>, save = true): void =>
    rideLayout.update(tile.key, patch, save)

  function setMetric(i: number, id: MetricId): void {
    set({ metrics: tile.metrics.map((m, j) => (j === i ? id : m)) })
  }

  /** Colours stay in step with the numbers; all-default drops the list. */
  function colorsPatch(colors: (string | null)[]): Pick<TileSpec, 'colors'> {
    return { colors: colors.some((c) => c !== null) ? colors : undefined }
  }
  const colorAt = (i: number): string | null => tile.colors?.[i] ?? null

  function setColor(i: number, c: string | null, save = true): void {
    set(colorsPatch(tile.metrics.map((_, j) => (j === i ? c : colorAt(j)))), save)
  }

  function removeMetric(i: number): void {
    set({
      metrics: tile.metrics.filter((_, j) => j !== i),
      ...colorsPatch(tile.metrics.map((_, j) => colorAt(j)).filter((_, j) => j !== i)),
    })
  }

  function moveMetric(i: number, by: -1 | 1): void {
    const j = i + by
    if (j < 0 || j >= tile.metrics.length) return
    const swap = <T,>(a: T[]): T[] => {
      const out = [...a]
      ;[out[i], out[j]] = [out[j]!, out[i]!]
      return out
    }
    set({
      metrics: swap(tile.metrics),
      ...colorsPatch(swap(tile.metrics.map((_, k) => colorAt(k)))),
    })
  }

  function addMetric(): void {
    set({
      metrics: [...tile.metrics, 'hr'],
      ...colorsPatch([...tile.metrics.map((_, j) => colorAt(j)), null]),
    })
  }

  /** Merges into the panel's style; defaults drop out (cleanPanelStyle). */
  function setStyle(patch: Partial<Record<keyof PanelStyle, unknown>>, save = true): void {
    set({ style: cleanPanelStyle({ ...tile.style, ...patch }) }, save)
  }
  const st = $derived<PanelStyle>(tile.style ?? {})
  /** Which style controls each panel has. */
  const HAS: Record<PanelId, { text: boolean; ftp: boolean; next: boolean; legend: boolean }> = {
    workout: { text: true, ftp: true, next: true, legend: false },
    chart: { text: true, ftp: false, next: false, legend: true },
    route: { text: true, ftp: false, next: true, legend: false },
    map: { text: false, ftp: false, next: false, legend: false },
    world: { text: false, ftp: false, next: false, legend: false },
  }

  const place = (to: { w?: number; h?: number }): void => {
    rideLayout.place(tile.key, to)
    rideLayout.save()
  }
</script>

{#snippet colour(
  name: string,
  value: string | undefined,
  onpick: (c: string | undefined, save?: boolean) => void,
)}
  <div class="colour">
    <span class="name">{name}</span>
    <button class="small" class:on={value === undefined} onclick={() => onpick(undefined)}
      >{L.themeColour}</button
    >
    {#each SWATCHES as c (c)}
      <button
        class="swatch"
        class:on={value === c}
        style:background={c}
        title={c}
        aria-label={c}
        onclick={() => onpick(c)}
      ></button>
    {/each}
    <input
      type="color"
      value={value ?? '#1b2027'}
      aria-label={name}
      oninput={(e) => onpick(e.currentTarget.value, false)}
      onchange={() => rideLayout.save()}
    />
  </div>
{/snippet}

{#snippet scale(
  name: string,
  value: number | undefined,
  onset: (v: number, save?: boolean) => void,
)}
  <label class="row">
    <span class="name">{name}</span>
    <input
      type="range"
      min="0.5"
      max="3"
      step="0.1"
      value={value ?? 1}
      oninput={(e) => onset(e.currentTarget.valueAsNumber, false)}
      onchange={() => rideLayout.save()}
    />
    <span class="muted">{Math.round((value ?? 1) * 100)} %</span>
  </label>
{/snippet}

{#snippet toggle(name: string, value: false | undefined, onset: (on: boolean) => void)}
  <label class="check">
    <input
      type="checkbox"
      checked={value !== false}
      onchange={(e) => onset(e.currentTarget.checked)}
    />
    {name}
  </label>
{/snippet}

<section class="card editor" aria-label={L.tile}>
  <div class="head">
    <h3>{tile.panel ? L.panels[tile.panel].name : L.tile}</h3>
    <label class="check lock">
      <input
        type="checkbox"
        checked={!!tile.locked}
        onchange={(e) => set({ locked: e.currentTarget.checked ? true : undefined })}
      />
      {L.locked}
    </label>
  </div>

  {#if tile.panel}
    <p class="muted">{L.panels[tile.panel].when}</p>
  {:else}
    <h4>{L.numbers}</h4>
    {#each tile.metrics as m, i (i)}
      {@const c = colorAt(i)}
      <div class="metric">
        <select value={m} onchange={(e) => setMetric(i, e.currentTarget.value as MetricId)}>
          {#each GROUPS as g (g.id)}
            <optgroup label={t().ride.metricGroups[g.id]}>
              {#each g.metrics as id (id)}<option value={id}>{names[id].long}</option>{/each}
            </optgroup>
          {/each}
        </select>
        <input
          type="color"
          class:unset={c === null}
          value={c ?? tile.fg ?? '#e8eaed'}
          title={L.numberColour}
          aria-label={L.numberColour}
          oninput={(e) => setColor(i, e.currentTarget.value, false)}
          onchange={() => rideLayout.save()}
        />
        {#if c !== null}
          <button
            class="small"
            title={L.themeColour}
            aria-label={L.themeColour}
            onclick={() => setColor(i, null)}>↺</button
          >
        {/if}
        <span class="spacer"></span>
        {#if tile.metrics.length > 1}
          <button
            class="small"
            disabled={i === 0}
            title={L.moveUp}
            aria-label={L.moveUp}
            onclick={() => moveMetric(i, -1)}>↑</button
          >
          <button
            class="small"
            disabled={i === tile.metrics.length - 1}
            title={L.moveDown}
            aria-label={L.moveDown}
            onclick={() => moveMetric(i, 1)}>↓</button
          >
          <button
            class="small"
            title={L.removeNumber}
            aria-label={L.removeNumber}
            onclick={() => removeMetric(i)}>✕</button
          >
        {/if}
      </div>
    {/each}
    {#if tile.metrics.length < MAX_TILE_METRICS}
      <button class="small" onclick={addMetric}>+ {L.addNumber}</button>
    {/if}
  {/if}

  <h4>{L.look}</h4>
  <div class="size">
    <label
      >{L.width}
      <input
        type="number"
        min="1"
        max={GRID_COLUMNS}
        value={tile.w}
        disabled={tile.locked}
        onchange={(e) => place({ w: e.currentTarget.valueAsNumber })}
      /></label
    >
    <label
      >{L.height}
      <input
        type="number"
        min="1"
        max={MAX_TILE_ROWS}
        value={tile.h}
        disabled={tile.locked}
        onchange={(e) => place({ h: e.currentTarget.valueAsNumber })}
      /></label
    >
  </div>

  {#if !tile.panel}
    <div class="row">
      <span class="name">{L.align}</span>
      <span class="seg" role="group" aria-label={L.align}>
        {#each TILE_ALIGNS as a (a)}
          <button
            class="small"
            class:on={(tile.align ?? 'left') === a}
            aria-pressed={(tile.align ?? 'left') === a}
            onclick={() => set({ align: a === 'left' ? undefined : a })}>{L.aligns[a]}</button
          >
        {/each}
      </span>
    </div>

    <label class="row">
      <span class="name">{L.animation}</span>
      <select
        value={tile.animation ?? ''}
        onchange={(e) =>
          set({ animation: (e.currentTarget.value || undefined) as TileAnimation | undefined })}
      >
        <option value="">{L.animations.none}</option>
        {#each TILE_ANIMATIONS as a (a)}<option value={a}>{L.animations[a]}</option>{/each}
      </select>
    </label>

    {@render colour(L.background, tile.bg, (c, save) => set({ bg: c }, save))}
    {@render colour(L.text, tile.fg, (c, save) => set({ fg: c }, save))}
    <label class="check">
      <input
        type="checkbox"
        checked={tile.zoneBar !== false}
        onchange={(e) => set({ zoneBar: e.currentTarget.checked ? undefined : false })}
      />
      {L.zoneBar}
    </label>
    <label class="check">
      <input
        type="checkbox"
        checked={!!tile.targetTint}
        onchange={(e) => set({ targetTint: e.currentTarget.checked ? true : undefined })}
      />
      {L.targetTint}
    </label>
  {/if}

  {#if tile.panel && tile.panel !== 'world'}
    {@const has = HAS[tile.panel]}
    {@render colour(L.background, st.bg, (c, save) => setStyle({ bg: c }, save))}
    {#if has.text}
      <h4>{L.panelTexts}</h4>
      {@render colour(L.textColour, st.text, (c, save) => setStyle({ text: c }, save))}
      {@render scale(L.textSize, st.textScale, (v, save) => setStyle({ textScale: v }, save))}
      {@render toggle(L.showAxes, st.axes, (on) => setStyle({ axes: on ? undefined : false }))}
      {@render toggle(L.showTitles, st.titles, (on) =>
        setStyle({ titles: on ? undefined : false }),
      )}
      {#if has.ftp}
        {@render toggle(L.showFtp, st.ftp, (on) => setStyle({ ftp: on ? undefined : false }))}
      {/if}
      {#if has.legend}
        {@render toggle(L.showLegend, st.legend, (on) =>
          setStyle({ legend: on ? undefined : false }),
        )}
      {/if}
    {/if}
    {#if has.next}
      <h4>{tile.panel === 'workout' ? L.nextLine : L.routeNote}</h4>
      {@render toggle(L.show, st.next, (on) => setStyle({ next: on ? undefined : false }))}
      {#if st.next !== false}
        {@render colour(L.textColour, st.nextColor, (c, save) => setStyle({ nextColor: c }, save))}
        {@render scale(L.textSize, st.nextScale, (v, save) => setStyle({ nextScale: v }, save))}
      {/if}
    {/if}
  {/if}

  <div class="actions">
    <button class="danger" onclick={() => rideLayout.remove(tile.key)}>{L.remove}</button>
    <button onclick={() => (rideLayout.selected = undefined)}>{L.close}</button>
  </div>
</section>

<style>
  .editor {
    max-width: none;
    display: grid;
    gap: 0.5rem;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  h3,
  h4 {
    margin: 0;
  }
  h4 {
    margin-top: 0.4rem;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
  .metric,
  .size,
  .colour,
  .row,
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .metric select {
    flex: 1 1 10rem;
    min-width: 0;
  }
  .spacer {
    flex: 0;
  }
  .size input {
    width: 4.5rem;
  }
  .name {
    min-width: 7rem;
  }
  .seg {
    display: inline-flex;
    gap: 0.25rem;
  }
  .swatch {
    width: 1.6rem;
    height: 1.6rem;
    padding: 0;
    border: 2px solid var(--muted);
    border-radius: 50%;
  }
  .on {
    outline: 2px solid var(--series-1);
    outline-offset: 1px;
  }
  .small {
    font-size: 0.85rem;
    padding: 0.1rem 0.5rem;
    justify-self: start;
  }
  input[type='color'] {
    width: 2.2rem;
    height: 1.8rem;
    padding: 0;
    border: none;
    background: none;
  }
  input[type='color'].unset {
    opacity: 0.45;
  }
  .check {
    margin-left: 0;
  }
  .lock {
    font-weight: 600;
  }
  .actions {
    justify-content: space-between;
  }
  .muted {
    color: var(--muted);
    margin: 0;
  }
  .danger {
    color: var(--error);
  }
</style>
