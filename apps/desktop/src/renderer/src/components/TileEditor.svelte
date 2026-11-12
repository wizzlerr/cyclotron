<script lang="ts">
  // Editor for one Ride screen tile (E4-6): its numbers, size and colours. Changes apply live.
  import {
    GRID_COLUMNS,
    MAX_TILE_METRICS,
    MAX_TILE_ROWS,
    type MetricId,
    type TileSpec,
  } from '@cyclotron/core'
  import { t } from '../i18n/t'
  import { rideLayout } from '../ride/layout.svelte'

  let { tile }: { tile: TileSpec } = $props()

  const GROUPS: { id: 'power' | 'body' | 'time' | 'route'; metrics: MetricId[] }[] = [
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
    { id: 'body', metrics: ['hr', 'avgHr', 'maxHr', 'cadence', 'avgCadence', 'speed'] },
    { id: 'time', metrics: ['intervalLeft', 'elapsed', 'total', 'workoutLeft'] },
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

  const set = (patch: Partial<Omit<TileSpec, 'key'>>, save = true): void =>
    rideLayout.update(tile.key, patch, save)

  function setMetric(i: number, id: MetricId): void {
    set({ metrics: tile.metrics.map((m, j) => (j === i ? id : m)) })
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

<section class="card editor" aria-label={L.tile}>
  <h3>{L.numbers}</h3>
  {#each tile.metrics as m, i (i)}
    <div class="metric">
      <select value={m} onchange={(e) => setMetric(i, e.currentTarget.value as MetricId)}>
        {#each GROUPS as g (g.id)}
          <optgroup label={t().ride.metricGroups[g.id]}>
            {#each g.metrics as id (id)}<option value={id}>{names[id].long}</option>{/each}
          </optgroup>
        {/each}
      </select>
      {#if tile.metrics.length > 1}
        <button
          class="small"
          title={L.removeNumber}
          aria-label={L.removeNumber}
          onclick={() => set({ metrics: tile.metrics.filter((_, j) => j !== i) })}>✕</button
        >
      {/if}
    </div>
  {/each}
  {#if tile.metrics.length < MAX_TILE_METRICS}
    <button class="small" onclick={() => set({ metrics: [...tile.metrics, 'hr'] })}
      >+ {L.addNumber}</button
    >
  {/if}

  <div class="size">
    <label
      >{L.width}
      <input
        type="number"
        min="1"
        max={GRID_COLUMNS}
        value={tile.w}
        onchange={(e) => set({ w: e.currentTarget.valueAsNumber })}
      /></label
    >
    <label
      >{L.height}
      <input
        type="number"
        min="1"
        max={MAX_TILE_ROWS}
        value={tile.h}
        onchange={(e) => set({ h: e.currentTarget.valueAsNumber })}
      /></label
    >
  </div>

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
  h3 {
    margin: 0;
  }
  .metric,
  .size,
  .colour,
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .size input {
    width: 4.5rem;
  }
  .name {
    min-width: 8rem;
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
  .check {
    margin-left: 0;
  }
  .actions {
    justify-content: space-between;
  }
  .danger {
    color: var(--error);
  }
</style>
