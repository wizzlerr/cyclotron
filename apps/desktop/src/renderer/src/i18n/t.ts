// `t()` returns the strings for the current language. Reading it inside a component or $derived
// makes that code re-run when the language changes (E15, DESIGN.md D21).
import { catalogues, type Messages } from './catalog'
import { i18n } from './i18n.svelte'

export function t(): Messages {
  return catalogues[i18n.lang]
}
