<script lang="ts" module>
  export interface TilePart {
    /** Numbers are rounded (or shown with `digits`); strings (e.g. times) are shown as is. */
    value: number | string | undefined
    /** Decimals for a number (default 0). */
    digits?: number
    /** Text colour of this value, and of its name under it. */
    color?: string
    /** Its name, shown centred under it ("Interval | Elapsed | Total"). */
    name?: string
    /** Its own unit, shown after it when the parts' units differ. */
    unit?: string
    /**
     * Its usual widest text ("000" for watts, "0:00:00" for a time): the value always takes at
     * least this much room, so it doesn't shift or resize as its digits change.
     */
    template?: string
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
    tint = undefined,
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
    /** Mixed into the background, fading from one colour to the next (how close to target). */
    tint?: string
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
  const named = $derived(parts?.some((p) => p.name) ?? false)
  /** Parts with different units show each unit after its number. */
  const ownUnits = $derived(parts !== undefined && new Set(parts.map((p) => p.unit ?? '')).size > 1)
  const tileUnit = $derived(parts && !ownUnits ? (parts[0]?.unit ?? unit) : unit)
  /** A value's room in characters: its usual widest text, or more when it is longer. */
  const width = (p: TilePart): number =>
    Math.max(show(p.value, p.digits).length, p.template?.length ?? 0)
  /** Characters on the value line, so the font can shrink to fit a narrow tile. Counts the
   * reserved widths, so the size doesn't jump when a number gains a digit. */
  const chars = $derived(
    shown.reduce((n, p) => n + width(p) + (ownUnits ? (p.unit ?? '').length * 0.4 : 0), 0) +
      (shown.length - 1) * 2 +
      tileUnit.length * 0.5,
  )
  /** Grid columns: value, separator, value, … (the unit sits in the last value's column). */
  const valueCols = $derived(shown.length * 2 - 1)
  const background = $derived(
    tint ? `color-mix(in srgb, ${tint} 38%, ${bg ?? 'var(--panel)'})` : bg,
  )
</script>

<div
  class="tile align-{align}"
  class:highlight
  class:fill
  class:glow={animation === 'glow'}
  style:border-left-color={accent ?? 'transparent'}
  style:background-color={background}
  style:color={fg}
  style:--glow={accent ?? fg ?? 'var(--series-1)'}
  style:--chars={Math.max(4, chars)}
>
  <div class="block">
    {#each shown as p, i (i)}
      {#if i > 0}<span class="sep" style:grid-column={i * 2}>{sep}</span>{/if}
      <span class="value" style:grid-column={i * 2 + 1} style:color={p.color}
        ><span class="slot"
          >{#if p.template}<span class="ghost" aria-hidden="true">{p.template}</span>{/if}<span
            class="num"
            >{#if animation === 'count' && typeof p.value === 'number'}<TileNumber
                value={p.value}
                digits={p.digits ?? 0}
              />{:else if animation === 'pulse'}{#key show(p.value, p.digits)}<span class="pop"
                  >{show(p.value, p.digits)}</span
                >{/key}{:else}{show(p.value, p.digits)}{/if}</span
          ></span
        >{#if ownUnits && p.unit}<span class="own-unit">{p.unit}</span
          >{:else if tileUnit && !ownUnits && i === shown.length - 1}<span class="unit"
            >{tileUnit}</span
          >{/if}</span
      >
      {#if named}<span class="name" style:grid-column={i * 2 + 1} style:color={p.color}
          >{p.name}</span
        >{/if}
    {/each}
    {#if !named}<span class="name" style:grid-column="1 / span {valueCols}">{label}</span>{/if}
  </div>
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
    transition: background-color 0.6s ease;
  }
  .align-left {
    align-items: flex-start;
  }
  .align-center {
    align-items: center;
  }
  .align-right {
    align-items: flex-end;
  }
  /* Values on the first row, each name centred under its value on the second. */
  .block {
    display: grid;
    grid-auto-columns: auto;
    grid-template-rows: auto auto;
    justify-content: start;
    align-items: baseline;
    column-gap: 0.4rem;
    max-width: 100%;
    /* Grows with the window so numbers stay readable from the bike on a big display; on a short
       window it shrinks a little to leave room for the charts; and it never overflows the tile
       (about 0.6 em per digit). */
    --vf: min(clamp(1.9rem, min(1.2rem + 1.2vw, 5vh), 4.5rem), calc(160cqi / var(--chars)));
  }
  .value,
  .sep {
    grid-row: 1;
  }
  /* Value and name share a column and are centred in it. */
  .value {
    justify-self: center;
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
  .tile.fill .block {
    /* The label line takes ~1.2rem; the rest is the number (line-height 1.15). */
    --vf: min(calc((100cqh - 1.2rem) / 1.2), calc(160cqi / var(--chars)), 14rem);
  }
  .tile.fill .unit,
  .tile.fill .name {
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
    font-size: var(--vf);
    line-height: 1.15;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  /* The value's reserved room: its usual widest text, invisible, with the value on top of it,
     right-aligned like a scoreboard. */
  .slot {
    display: inline-grid;
    justify-items: end;
  }
  .slot > * {
    grid-area: 1 / 1;
  }
  .ghost {
    visibility: hidden;
  }
  .sep {
    font-size: var(--vf);
    line-height: 1.15;
    color: var(--muted);
    font-weight: 400;
    opacity: 0.6;
  }
  .unit {
    color: var(--muted);
    font-size: 1rem;
    font-weight: 400;
    margin-left: 0.4rem;
  }
  .name {
    grid-row: 2;
    justify-self: center;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    text-align: center;
    color: var(--muted);
    font-size: 0.8rem;
    white-space: nowrap;
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
    .tile {
      transition: none;
    }
    .pop,
    .glow {
      animation: none;
    }
  }
</style>
