<script lang="ts">
  import { devices } from '../devices/devices.svelte'
  import { t } from '../i18n/t'

  /** Which controller button does this (shown only while a controller is connected). */
  let { button }: { button: 'a' | 'b' | 'y' | 'z' | 'plus' | 'minus' } = $props()

  const label = { a: 'A', b: 'B', y: 'Y', z: 'Z', plus: '+', minus: '−' }
</script>

{#if devices.controllers.length}
  <span class="pad-hint {button}" title={t().controllers.hint(label[button])} aria-hidden="true"
    >{label[button]}</span
  >
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
  .plus,
  .minus {
    background: #8a93a0;
  }
</style>
