// UI language (E15, DESIGN.md D21): the current language and locale-aware formatting. The
// strings themselves come from `t()` in ./t.ts.
import { loadPref, savePref } from '../lib/prefs'

export type Lang = 'en' | 'pl'

export const LANGUAGES: readonly { id: Lang; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'pl', name: 'Polski' },
]

const KEY = 'cyclotron.language'
const LOCALES: Record<Lang, string> = { en: 'en-GB', pl: 'pl-PL' }

function initialLang(): Lang {
  const saved = loadPref<Lang>(KEY)
  if (saved === 'en' || saved === 'pl') return saved
  return navigator.language.toLowerCase().startsWith('pl') ? 'pl' : 'en'
}

class I18n {
  lang = $state<Lang>(initialLang())

  /** BCP 47 locale for Intl formatting. */
  get locale(): string {
    return LOCALES[this.lang]
  }

  set(lang: Lang): void {
    this.lang = lang
    savePref(KEY, lang)
    this.apply()
  }

  apply(): void {
    document.documentElement.lang = this.lang
  }
}

export const i18n = new I18n()

/** English plural: `pluralEn(3, 'ride', 'rides')` → "3 rides". */
export function pluralEn(n: number, one: string, other: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : other}`
}

/**
 * Polish plural: one (1), few (2–4, 22–24…), many (5–21, 25…, 0). Fractions use `few`
 * ("1,5 godziny"). `pluralPl(5, 'trening', 'treningi', 'treningów')` → "5 treningów".
 */
export function pluralPl(n: number, one: string, few: string, many: string): string {
  const form = new Intl.PluralRules('pl-PL').select(n)
  const word = form === 'one' ? one : form === 'few' ? few : form === 'many' ? many : few
  return `${formatNumber(n)} ${word}`
}

/** Number in the UI's locale, e.g. 1.5 → "1,5" in Polish. */
export function formatNumber(n: number, digits?: number): string {
  return n.toLocaleString(i18n.locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits ?? 3,
  })
}

/** Date in the UI's locale; `opts` defaults to a medium date. */
export function formatDate(
  ms: number,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return new Intl.DateTimeFormat(i18n.locale, opts).format(ms)
}

/** Date and time, e.g. "22 Oct 2026, 09:45". */
export function formatDateTime(ms: number): string {
  return formatDate(ms, { dateStyle: 'medium', timeStyle: 'short' })
}
