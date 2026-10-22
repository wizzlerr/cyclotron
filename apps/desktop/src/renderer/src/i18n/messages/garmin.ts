// Strings for Garmin Connect (E12): sending rides, the Personal API key in Settings. See common.ts
// for the glossary; `pl` must match `en` key for key.
import type { GarminStatus } from '../../../../shared/api'

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
  disconnect: 'Disconnect',
  sample: 'Save sample data…',
  sampleHint:
    'Saves a week of your Garmin data to a file in the app folder, to check what Garmin provides. It stays on this computer.',
  sampleSaved: (file: string) => `Saved ${file}`,
  ok: 'Garmin answered: the key works.',
  stored: 'The key is stored encrypted on this computer and only used to talk to Garmin.',
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
  disconnect: 'Rozłącz',
  sample: 'Zapisz przykładowe dane…',
  sampleHint:
    'Zapisuje tydzień twoich danych z Garmina do pliku w folderze aplikacji, żeby sprawdzić, co Garmin udostępnia. Plik zostaje na tym komputerze.',
  sampleSaved: (file: string) => `Zapisano ${file}`,
  ok: 'Garmin odpowiedział: klucz działa.',
  stored: 'Klucz jest zaszyfrowany na tym komputerze i służy tylko do łączenia z Garminem.',
  errors: {
    noKey: 'Brak zapisanego klucza.',
    invalidKey: 'Garmin odrzucił klucz. Może być błędnie wpisany, usunięty albo wygasły.',
    network: 'Brak połączenia z Garminem. Sprawdź internet.',
    http: 'Garmin zwrócił błąd',
    encryption: 'Ten komputer nie może bezpiecznie przechować klucza, więc go nie zapisano.',
  },
}
