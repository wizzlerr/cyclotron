<script lang="ts" module>
  export interface TilePart {
    /** Numbers are rounded (or shown with `digits`); strings (e.g. times) are shown as is. */
    value: number | string | undefined
    /** Decimals for a number (default 0). */
    digits?: number
    /** Text colour of this value, and of its name in the label. */
    color?: string
    /** Its name, for the label of a combined tile ("Interval | Elapsed | Total"). */
    name?: string
    /** Its own unit, shown after it when the parts' units differ. */
    unit?: string
  }
</script>

<script lang="ts">
  import type { TileAlign, TileAnimation } from '@cyclotron/core'
  import { formatNumber } from '../i18n/i18n.svelte'
  import TileNumber from './TileNumber.svelte'

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
    align = 'left',
    animation = undefined,
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
    align?: TileAlign
    animation?: TileAnimation
  } = $props()

  const show = (v: number | string | undefined, digits = 0): string =>
    v === undefined
      ? '–'
      : typeof v === 'number'
        ? digits > 0
          ? formatNumber(v, digits)
          : String(Math.round(v))
        : v

  const shown = $derived<TilePart[]>(parts ?? [{ value }])
  /** Characters on the value line, so the font can shrink to fit a narrow tile. */
  const named = $derived(parts?.some((p) => p.name) ?? false)
  /** Parts with different units show each unit after its number. */
  const ownUnits = $derived(parts !== undefined && new Set(parts.map((p) => p.unit ?? '')).size > 1)
  const tileUnit = $derived(parts && !ownUnits ? (parts[0]?.unit ?? unit) : unit)
  const chars = $derived(
    shown.reduce(
      (n, p) => n + show(p.value, p.digits).length + (ownUnits ? (p.unit ?? '').length * 0.4 : 0),
      0,
    ) +
      (shown.length - 1) * 2 +
      tileUnit.length * 0.5,
  )
</script>

<div
  class="tile align-{align}"
  class:highlight
  class:fill
  class:glow={animation === 'glow'}
  style:border-left-color={accent ?? 'transparent'}
  style:background={bg}
  style:color={fg}
  style:--glow={accent ?? fg ?? 'var(--series-1)'}
  style:--chars={Math.max(4, chars)}
>
  <span class="line">
    <span class="value">
      {#each shown as p, i (i)}{#if i > 0}<span class="sep">{sep}</span>{/if}<span
          style:color={p.color}
          >{#if animation === 'count' && typeof p.value === 'number'}<TileNumber
              value={p.value}
              digits={p.digits ?? 0}
            />{:else if animation === 'pulse'}{#key show(p.value, p.digits)}<span class="pop"
                >{show(p.value, p.digits)}</span
              >{/key}{:else}{show(p.value, p.digits)}{/if}</span
        >{#if ownUnits && p.unit}<span class="own-unit">{p.unit}</span>{/if}{/each}
    </span>
    {#if !ownUnits && tileUnit}<span class="unit">{tileUnit}</span>{/if}
  </span>
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
    display: flex;
    flex-direction: column;
    container-type: inline-size;
    min-width: 0;
  }
  .align-left {
    align-items: flex-start;
    text-align: left;
  }
  .align-center {
    align-items: center;
    text-align: center;
  }
  .align-right {
    align-items: flex-end;
    text-align: right;
  }
  .line {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    max-width: 100%;
  }
  /* A cell of the Ride screen grid: as tall as its rows, numbers sized by both width and height. */
  .tile.fill {
    container-type: size;
    padding: 0.4rem 0.9rem;
    height: 100%;
    box-sizing: border-box;
    justify-content: center;
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
    max-width: 100%;
    color: var(--muted);
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .pop {
    display: inline-block;
    animation: pop 0.35s ease-out;
  }
  @keyframes pop {
    30% {
      transform: scale(1.12);
    }
  }
  .glow {
    animation: glow 2.4s ease-in-out infinite;
  }
  @keyframes glow {
    50% {
      box-shadow: inset 0 0 1.6rem color-mix(in srgb, var(--glow) 55%, transparent);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pop,
    .glow {
      animation: none;
    }
  }
</style>
