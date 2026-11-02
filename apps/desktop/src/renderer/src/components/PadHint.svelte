<script lang="ts">
  import { devices } from '../devices/devices.svelte'
  import { t } from '../i18n/t'
  import { buttonBadge, padmap, type PadAction } from '../lib/padmap.svelte'

  /** Which controller button runs this (shown only while a controller is connected). */
  let { action }: { action: PadAction } = $props()

  /** One badge per distinct label: a Play's three "+" buttons show one "+". */
  const badges = $derived.by(() => {
    const out: [label: string, cls: string][] = []
    for (const b of padmap.buttons(action)) {
      const label = buttonBadge(b)
      if (!out.some(([l]) => l === label)) out.push([label, /^[a-z]$/.test(b) ? b : 'other'])
    }
    return out.slice(0, 2)
  })
</script>

{#if devices.controllers.length}
  {#each badges as [label, cls] (label)}
    <span class="pad-hint {cls}" title={t().controllers.hint(label)} aria-hidden="true"
      >{label}</span
    >
  {/each}
{/if}

<style>
  .pad-hint {
    display: inline-grid;
    place-items: center;
    width: 1.25em;
    height: 1.25em;
    margin-left: 0.4em;
    border-radius: 50%;
    font-size: 0.8em;
    font-weight: 700;
    line-height: 1;
    vertical-align: middle;
    color: #111418;
    flex: none;
  }
  /* Gamepad-style colours, so each letter is easy to spot. */
  .a {
    background: #4fb477;
  }
  .b {
    background: #e0533d;
  }
  .y {
    background: #e5c349;
  }
  .z {
    background: #4a90d9;
  }
  .other {
    background: #c3c9d1;
  }
</style>
