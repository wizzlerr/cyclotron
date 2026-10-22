// Strings for Strava upload (E12-7). See common.ts for the glossary; `pl` must match `en`.
import type { StravaStatus } from '../../../../shared/api'

type StravaError = NonNullable<StravaStatus['error']>

export const en = {
  title: 'Strava',
  intro:
    "Upload rides to Strava. Strava needs an API app of your own (it's free and takes a minute), so Cyclotron never holds anyone else's keys. Strava doesn't pass rides on to Garmin.",
  steps: [
    'Open strava.com/settings/api and create an application (any name; website: anything, e.g. https://github.com/wizzlerr/cyclotron).',
    'Set "Authorization Callback Domain" to localhost.',
    'Copy the Client ID and Client Secret here, then Connect.',
  ],
  openApiPage: 'Open strava.com/settings/api',
  clientId: 'Client ID',
  clientSecret: 'Client Secret',
  saveApp: 'Save',
  connect: 'Connect to Strava…',
  connecting: 'Waiting for Strava in your browser…',
  connected: (who: string) => (who ? `Connected as ${who}.` : 'Connected.'),
  appSaved: (id: string) => `API app ${id} saved: connect next.`,
  auto: 'Upload every finished ride automatically',
  disconnect: 'Disconnect',
  send: 'Send to Strava',
  sending: 'Sending…',
  onStrava: 'On Strava ↗',
  stored: 'The secret and Strava tokens are stored encrypted on this computer.',
  errors: {
    noApp: 'Enter a valid Client ID (digits) and Client Secret.',
    notConnected: 'Connect to Strava first (Settings → Strava).',
    denied: 'Strava refused: check the Client ID/Secret and allow uploading when Strava asks.',
    timeout: 'No answer from Strava within 5 minutes.',
    network: "Couldn't reach Strava. Check the internet connection.",
    http: 'Strava returned an error.',
    encryption: "This computer can't store secrets securely, so nothing was saved.",
    noFit: 'This ride has no FIT file to upload.',
    rejected: 'Strava rejected the file.',
  } satisfies Record<StravaError, string>,
}

export const pl: typeof en = {
  title: 'Strava',
  intro:
    'Wysyłaj jazdy do Stravy. Strava wymaga twojej własnej aplikacji API (za darmo, zajmuje minutę), więc Cyclotron nie trzyma niczyich kluczy. Strava nie przekazuje jazd do Garmina.',
  steps: [
    'Otwórz strava.com/settings/api i utwórz aplikację (dowolna nazwa; strona: cokolwiek, np. https://github.com/wizzlerr/cyclotron).',
    'W „Authorization Callback Domain” wpisz localhost.',
    'Skopiuj tutaj Client ID i Client Secret, potem Połącz.',
  ],
  openApiPage: 'Otwórz strava.com/settings/api',
  clientId: 'Client ID',
  clientSecret: 'Client Secret',
  saveApp: 'Zapisz',
  connect: 'Połącz ze Stravą…',
  connecting: 'Czekam na Stravę w przeglądarce…',
  connected: (who: string) => (who ? `Połączono jako ${who}.` : 'Połączono.'),
  appSaved: (id: string) => `Aplikacja API ${id} zapisana: teraz połącz.`,
  auto: 'Wysyłaj automatycznie każdą zakończoną jazdę',
  disconnect: 'Rozłącz',
  send: 'Wyślij do Stravy',
  sending: 'Wysyłam…',
  onStrava: 'Na Stravie ↗',
  stored: 'Sekret i tokeny Stravy są zaszyfrowane na tym komputerze.',
  errors: {
    noApp: 'Wpisz poprawny Client ID (cyfry) i Client Secret.',
    notConnected: 'Najpierw połącz się ze Stravą (Ustawienia → Strava).',
    denied: 'Strava odmówiła: sprawdź Client ID/Secret i zezwól na wysyłanie, gdy Strava zapyta.',
    timeout: 'Brak odpowiedzi ze Stravy przez 5 minut.',
    network: 'Brak połączenia ze Stravą. Sprawdź internet.',
    http: 'Strava zwróciła błąd.',
    encryption: 'Ten komputer nie może bezpiecznie przechować sekretów, więc nic nie zapisano.',
    noFit: 'Ta jazda nie ma pliku FIT do wysłania.',
    rejected: 'Strava odrzuciła plik.',
  },
}
