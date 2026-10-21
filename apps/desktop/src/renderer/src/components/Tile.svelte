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
    padding: 1rem 1.25rem;
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: baseline;
    column-gap: 0.4rem;
  }
  .tile.highlight .value {
    color: var(--warn);
  }
  .value {
    font-size: 3rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .unit {
    color: var(--muted);
  }
  .label {
    grid-column: 1 / -1;
    color: var(--muted);
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
