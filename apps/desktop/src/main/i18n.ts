import { app } from 'electron'
import { getSetting } from './db'

// Strings shown by main: file dialogs and FIT import results (E15). The renderer keeps the chosen
// language in the `pref:cyclotron.language` setting; before one is chosen, follow the system.

const en = {
  importFitTitle: 'Import rides from FIT files',
  fitFilter: 'FIT activities',
  fitFolderTitle: 'Folder for ride files (.fit)',
  importGpxTitle: 'Import GPX routes',
  gpxFilter: 'GPX routes',
  exportZwoTitle: 'Export workout',
  importZwoTitle: 'Import Zwift workouts',
  zwoFilter: 'Zwift workouts',
  notARide: (sport: string) => `not a ride (${sport})`,
  duplicate: 'already in your history',
  notFit: 'not a FIT file',
  noRecords: 'no data records in the file',
}

const pl: typeof en = {
  importFitTitle: 'Importuj jazdy z plików FIT',
  fitFilter: 'Aktywności FIT',
  fitFolderTitle: 'Folder na pliki jazd (.fit)',
  importGpxTitle: 'Importuj trasy GPX',
  gpxFilter: 'Trasy GPX',
  exportZwoTitle: 'Eksportuj trening',
  importZwoTitle: 'Importuj treningi Zwift',
  zwoFilter: 'Treningi Zwift',
  notARide: (sport: string) => `to nie jest jazda na rowerze (${sport})`,
  duplicate: 'jest już w historii',
  notFit: 'to nie jest plik FIT',
  noRecords: 'plik nie zawiera danych',
}

export function strings(): typeof en {
  let lang: unknown
  try {
    lang = JSON.parse(getSetting('pref:cyclotron.language') ?? 'null')
  } catch {
    lang = null
  }
  if (lang === 'pl' || lang === 'en') return lang === 'pl' ? pl : en
  return app.getLocale().toLowerCase().startsWith('pl') ? pl : en
}

/** A core error in the current language when it has a known code. */
export function errorText(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code
  const s = strings()
  if (code === 'notFit' || code === 'noRecords') return s[code]
  return e instanceof Error ? e.message : String(e)
}
