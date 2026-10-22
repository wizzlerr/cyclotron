<script lang="ts">
  let {
    label,
    value,
    unit = '',
    accent = undefined,
    highlight = false,
  }: {
    label: string
    /** Numbers are rounded; strings (e.g. times) are shown as is. */
    value: number | string | undefined
    unit?: string
    /** Colour bar on the left, e.g. the power zone. */
    accent?: string
    highlight?: boolean
  } = $props()
</script>

<div class="tile" class:highlight style:border-left-color={accent ?? 'transparent'}>
  <span class="value">
    {value === undefined ? '–' : typeof value === 'number' ? Math.round(value) : value}
  </span>
  <span class="unit">{unit}</span>
  <span class="label">{label}</span>
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
  }
  .tile.highlight .value {
    color: var(--warn);
  }
  .value {
    /* Grows with the window so numbers stay readable from the bike on a big display; on a short
       window it shrinks a little to leave room for the charts. */
    font-size: clamp(1.9rem, min(1.2rem + 1.2vw, 5vh), 4.5rem);
    line-height: 1.15;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
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
