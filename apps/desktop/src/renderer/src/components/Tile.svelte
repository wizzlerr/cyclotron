<script lang="ts" module>
  export interface TilePart {
    /** Numbers are rounded; strings (e.g. times) are shown as is. */
    value: number | string | undefined
    /** Text colour of this value, and of its name in the label. */
    color?: string
    /** Its name, for the label of a combined tile ("Interval | Elapsed | Total"). */
    name?: string
    /** Its own unit, shown after it when the parts' units differ. */
    unit?: string
  }
</script>

<script lang="ts">
  let {
    label,
    value = undefined,
    parts = undefined,
    sep = '|',
    unit = '',
    accent = undefined,
    highlight = false,
    bg = undefined,
    fg = undefined,
    fill = false,
  }: {
    label: string
    /** Numbers are rounded; strings (e.g. times) are shown as is. */
    value?: number | string | undefined
    /** Several values in one tile, e.g. power / target; replaces `value`. */
    parts?: TilePart[]
    sep?: string
    unit?: string
    /** Colour bar on the left, e.g. the power zone. */
    accent?: string
    highlight?: boolean
    /** Background and number colours (the rider's Ride screen layout). */
    bg?: string
    fg?: string
    /** Fills a fixed-size grid cell: the numbers grow with its height too (Ride screen). */
    fill?: boolean
  } = $props()

  const show = (v: number | string | undefined): string =>
    v === undefined ? '–' : typeof v === 'number' ? String(Math.round(v)) : v

  const shown = $derived(parts ?? [{ value }])
  /** Characters on the value line, so the font can shrink to fit a narrow tile. */
  const named = $derived(parts?.some((p) => p.name) ?? false)
  /** Parts with different units show each unit after its number. */
  const ownUnits = $derived(parts !== undefined && new Set(parts.map((p) => p.unit ?? '')).size > 1)
  const tileUnit = $derived(parts && !ownUnits ? (parts[0]?.unit ?? unit) : unit)
  const chars = $derived(
    shown.reduce(
      (n, p) => n + show(p.value).length + (ownUnits ? (p.unit ?? '').length * 0.4 : 0),
      0,
    ) +
      (shown.length - 1) * 2 +
      tileUnit.length * 0.5,
  )
</script>

<div
  class="tile"
  class:highlight
  class:fill
  style:border-left-color={accent ?? 'transparent'}
  style:background={bg}
  style:color={fg}
  style:--chars={Math.max(4, chars)}
>
  <span class="value">
    {#each shown as p, i (i)}{#if i > 0}<span class="sep">{sep}</span>{/if}<span
        style:color={p.color}>{show(p.value)}</span
      >{#if ownUnits && p.unit}<span class="own-unit">{p.unit}</span>{/if}{/each}
  </span>
  <span class="unit">{ownUnits ? '' : tileUnit}</span>
  <span class="label">
    {#if named && parts}
      {#each parts as p, i (i)}{#if i > 0}<span class="sep">{sep}</span>{/if}<span
          style:color={p.color}>{p.name}</span
        >{/each}
    {:else}
      {label}
    {/if}
  </span>
</div>

<style>
  .tile {
    background: var(--panel);
    border-radius: 8px;
    border-left: 6px solid transparent;
    padding: 0.75rem 1rem;
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: baseline;
    column-gap: 0.4rem;
    container-type: inline-size;
    min-width: 0;
  }
  /* A cell of the Ride screen grid: as tall as its rows, numbers sized by both width and height. */
  .tile.fill {
    container-type: size;
    padding: 0.4rem 0.9rem;
    height: 100%;
    box-sizing: border-box;
    align-content: center;
    overflow: hidden;
  }
  .tile.fill .value {
    /* The label line takes ~1.2rem; the rest is the number (line-height 1.15). */
    font-size: min(calc((100cqh - 1.2rem) / 1.2), calc(160cqi / var(--chars)), 14rem);
  }
  .tile.fill .unit,
  .tile.fill .label {
    color: inherit;
    opacity: 0.65;
  }
  .own-unit {
    font-size: 0.4em;
    font-weight: 400;
    opacity: 0.65;
    margin-left: 0.15em;
  }
  .tile.highlight .value {
    color: var(--warn);
  }
  .value {
    /* Grows with the window so numbers stay readable from the bike on a big display; on a short
       window it shrinks a little to leave room for the charts; and it never overflows the tile
       (about 0.6 em per digit). */
    font-size: min(clamp(1.9rem, min(1.2rem + 1.2vw, 5vh), 4.5rem), calc(160cqi / var(--chars)));
    line-height: 1.15;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .sep {
    color: var(--muted);
    font-weight: 400;
    margin: 0 0.25em;
    opacity: 0.6;
  }
  .unit {
    color: var(--muted);
  }
  .label {
    grid-column: 1 / -1;
    color: var(--muted);
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
