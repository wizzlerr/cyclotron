<script lang="ts">
  // A number that rolls to its new value (the tile "count" animation). Instant when the system asks
  // for reduced motion.
  import { cubicOut } from 'svelte/easing'
  import { Tween } from 'svelte/motion'
  import { formatNumber } from '../i18n/i18n.svelte'

  let { value, digits = 0 }: { value: number; digits?: number } = $props()

  const still =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const shown = Tween.of(() => value, { duration: still ? 0 : 600, easing: cubicOut })
</script>

{digits > 0 ? formatNumber(shown.current, digits) : String(Math.round(shown.current))}
