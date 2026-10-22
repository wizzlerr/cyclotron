// All UI strings, per language (E15, DESIGN.md D21). One file per area so they can be edited
// independently; every `pl` is typed against its `en`.
import * as app from './messages/app'
import * as common from './messages/common'
import * as content from './messages/content'
import * as garmin from './messages/garmin'
import * as history from './messages/history'
import * as library from './messages/library'
import * as reco from './messages/reco'
import * as ride from './messages/ride'

const AREAS = { common, app, ride, library, history, content, reco, garmin }

type Catalogue = { [K in keyof typeof AREAS]: (typeof AREAS)[K]['en'] }
export type Messages = Catalogue

function build(lang: 'en' | 'pl'): Catalogue {
  return Object.fromEntries(Object.entries(AREAS).map(([k, area]) => [k, area[lang]])) as Catalogue
}

export const catalogues: Record<'en' | 'pl', Catalogue> = { en: build('en'), pl: build('pl') }
