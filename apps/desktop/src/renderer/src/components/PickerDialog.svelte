<script lang="ts">
  // Shell for the visual pickers (RoutePicker, WorkoutPicker): a large modal with a grid of
  // clickable tiles. Children are `<button class="tile">` elements.
  import type { Snippet } from 'svelte'
  import { t } from '../i18n/t'

  let {
    heading,
    subtitle,
    oncancel,
    controls,
    children,
  }: {
    heading: string
    subtitle: string
    oncancel: () => void
    /** Search box and filters, shown top right. */
    controls?: Snippet
    children: Snippet
  } = $props()
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && oncancel()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={(e) => e.target === e.currentTarget && oncancel()}>
  <div class="dialog" role="dialog" aria-modal="true" aria-label={heading}>
    <div class="head">
      <div>
        <h2>{heading}</h2>
        <p class="muted">{subtitle}</p>
      </div>
      {#if controls}<div class="controls">{@render controls()}</div>{/if}
    </div>

    <div class="grid">{@render children()}</div>

    <div class="actions">
      <button onclick={oncancel}>{t().common.actions.cancel}</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
    background: rgb(0 0 0 / 0.6);
    display: grid;
    place-items: center;
  }
  .dialog {
    background: var(--panel);
    padding: 1.25rem 1.5rem;
    border-radius: 8px;
    width: min(76rem, 94vw);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  .head h2,
  .head p {
    margin: 0 0 0.25rem;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
    flex-shrink: 0;
    max-width: 50%;
  }
  .controls :global(input[type='search']) {
    width: 14rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
    gap: 0.6rem;
    overflow: auto;
    min-height: 0;
    padding: 2px;
  }
  .grid :global(.tile) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.35rem;
    text-align: left;
    padding: 0.75rem;
    background: var(--bg);
    border: 1px solid var(--grid);
    border-radius: 6px;
    color: var(--fg);
    font: inherit;
  }
  .grid :global(.tile:hover),
  .grid :global(.tile:focus-visible) {
    border-color: var(--series-1);
  }
  .grid :global(.tile.none) {
    justify-content: center;
  }
  .grid :global(.name) {
    font-weight: 600;
  }
  .grid :global(.star) {
    color: var(--warn);
  }
  .grid :global(.stats) {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .muted,
  .grid :global(.muted) {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .actions {
    text-align: right;
  }
</style>
