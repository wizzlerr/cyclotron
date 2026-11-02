// Strings for Garmin Connect (E12): sending rides, the Personal API key in Settings. See common.ts
// for the glossary; `pl` must match `en` key for key.
import type { GarminStatus } from '../../../../shared/api'
import { pluralPl } from '../i18n.svelte'

type GarminError = NonNullable<GarminStatus['error']>

export const en = {
  send: 'Send to Garmin',
  sendHint:
    "Garmin Connect's import page opens next to the ride's FIT file: drag the file onto the page.",
  title: 'Garmin Connect',
  intro:
    'Connect your Garmin account with a Personal API key so your sleep, HRV and other training can shape your recommendations. Rides are sent to Garmin with the "Send to Garmin" button after a ride.',
  howTo:
    'Create the key in Garmin Connect on the web: account settings → Personal API key. Copy it right away: Garmin shows it once.',
  keyLabel: 'Personal API key',
  keyPlaceholder: 'Paste your key',
  save: 'Connect',
  connected: (hint: string) => `Connected (key …${hint}).`,
  notConnected: 'Not connected.',
  lastOk: (date: string) => `Last successful contact: ${date}.`,
  expiryNote: 'Keys expire (you choose 30 days to a year); Garmin emails you a week before.',
  test: 'Test',
  sync: 'Sync now',
  synced: (date: string, n: number) =>
    `Last sync ${date}: ${n} other ${n === 1 ? 'activity' : 'activities'} (runs, outdoor rides…) in your training load.`,
  neverSynced: 'Not synced yet: it runs a few seconds after the app starts, then every 3 hours.',
  syncHint:
    'Other activities count for fitness, fatigue and form. Sleep, resting HR and Body Battery are used only when the watch is worn day and night.',
  disconnect: 'Disconnect',
  sample: 'Save sample data…',
  sampleHint:
    'Saves a week of your Garmin data to a file in the app folder, to check what Garmin provides. It stays on this computer.',
  sampleSaved: (file: string) => `Saved ${file}`,
  ok: 'Garmin answered: the key works.',
  stored: 'The key is stored encrypted on this computer and only used to talk to Garmin.',
  asDevice: 'Send rides as a Garmin device',
  asDeviceHint:
    'Garmin Connect only counts training load (and so training status and recovery) for rides from Garmin devices or partner apps. With this on, "Send to Garmin" hands over a copy of the FIT file, in a "garmin" folder next to it, that says it was recorded on a Garmin Edge 830, so Garmin works out the ride\'s exercise load. Delete the ride in Connect before sending it again. It\'s a workaround Garmin doesn\'t support and may stop honouring. Your own files and the Strava and intervals.icu uploads are unchanged.',
  errors: {
    noKey: 'No key saved.',
    invalidKey: 'Garmin rejected the key. It may be mistyped, deleted or expired.',
    network: "Couldn't reach Garmin. Check the internet connection.",
    http: 'Garmin returned an error',
    encryption: "This computer can't store the key securely, so it wasn't saved.",
  } satisfies Record<GarminError, string>,
}

export const pl: typeof en = {
  send: 'Wyślij do Garmina',
  sendHint:
    'Otworzy się strona importu Garmin Connect obok pliku FIT jazdy: przeciągnij plik na stronę.',
  title: 'Garmin Connect',
  intro:
    'Połącz konto Garmin kluczem Personal API, żeby sen, HRV i pozostałe treningi wpływały na rekomendacje. Jazdy wysyłasz do Garmina przyciskiem „Wyślij do Garmina” po jeździe.',
  howTo:
    'Utwórz klucz w Garmin Connect w przeglądarce: ustawienia konta → Personal API key. Skopiuj go od razu: Garmin pokazuje go tylko raz.',
  keyLabel: 'Klucz Personal API',
  keyPlaceholder: 'Wklej klucz',
  save: 'Połącz',
  connected: (hint: string) => `Połączono (klucz …${hint}).`,
  notConnected: 'Brak połączenia.',
  lastOk: (date: string) => `Ostatni udany kontakt: ${date}.`,
  expiryNote:
    'Klucze wygasają (od 30 dni do roku, do wyboru); Garmin wyśle ci e-mail tydzień wcześniej.',
  test: 'Sprawdź',
  sync: 'Synchronizuj',
  synced: (date: string, n: number) =>
    `Ostatnia synchronizacja ${date}: ${pluralPl(n, 'inna aktywność', 'inne aktywności', 'innych aktywności')} (bieganie, jazdy w terenie…) w obciążeniu treningowym.`,
  neverSynced:
    'Jeszcze nie zsynchronizowano: startuje kilka sekund po uruchomieniu aplikacji, potem co 3 godziny.',
  syncHint:
    'Inne aktywności liczą się do kondycji, zmęczenia i formy. Sen, tętno spoczynkowe i Body Battery są brane pod uwagę tylko, gdy zegarek jest noszony w dzień i w nocy.',
  disconnect: 'Rozłącz',
  sample: 'Zapisz przykładowe dane…',
  sampleHint:
    'Zapisuje tydzień twoich danych z Garmina do pliku w folderze aplikacji, żeby sprawdzić, co Garmin udostępnia. Plik zostaje na tym komputerze.',
  sampleSaved: (file: string) => `Zapisano ${file}`,
  ok: 'Garmin odpowiedział: klucz działa.',
  stored: 'Klucz jest zaszyfrowany na tym komputerze i służy tylko do łączenia z Garminem.',
  asDevice: 'Wysyłaj jazdy jako urządzenie Garmin',
  asDeviceHint:
    'Garmin Connect liczy obciążenie treningowe (a więc status treningu i regenerację) tylko dla jazd z urządzeń Garmin lub aplikacji partnerskich. Po włączeniu „Wyślij do Garmina” poda kopię pliku FIT (w folderze „garmin” obok), która twierdzi, że nagrał ją Garmin Edge 830, więc Garmin wyliczy obciążenie wysiłkowe jazdy. Przed ponownym wysłaniem usuń jazdę w Connect. To obejście, którego Garmin nie wspiera i może przestać uznawać. Twoje pliki oraz wysyłki do Strava i intervals.icu się nie zmieniają.',
  errors: {
    noKey: 'Brak zapisanego klucza.',
    invalidKey: 'Garmin odrzucił klucz. Może być błędnie wpisany, usunięty albo wygasły.',
    network: 'Brak połączenia z Garminem. Sprawdź internet.',
    http: 'Garmin zwrócił błąd',
    encryption: 'Ten komputer nie może bezpiecznie przechować klucza, więc go nie zapisano.',
  },
}
