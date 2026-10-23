// Words shared by many screens (E15). Each messages file exports `en` and `pl`; `pl` is typed as
// `typeof en`, so a missing or extra key fails typecheck.
//
// Glossary (keep translations consistent):
//   workout = trening · ride (noun) = jazda · Ride (button) = Jedź · free ride = jazda swobodna
//   route = trasa · trainer = trenażer · heart-rate strap = pas HR · device = urządzenie
//   power = moc · target = cel (moc docelowa) · heart rate = tętno · cadence = kadencja
//   speed = prędkość · distance = dystans · grade = nachylenie · climbing = przewyższenie
//   interval = interwał · step = krok · repeat = powtórzenie · warm-up = rozgrzewka
//   cool-down = schłodzenie · ramp = rampa · steady = stała moc · max effort = maksymalny wysiłek
//   level = poziom · favourites = ulubione · lap = okrążenie · elapsed = czas · calories = kalorie
//   fitness / fatigue / form (CTL/ATL/TSB) = kondycja / zmęczenie / forma
//   power curve = krzywa mocy · zone = strefa · FTP, ERG, TSS, IF, NP, W/kg stay as they are.
// Address the rider informally ("ty"), keep it short. Units: W, bpm, rpm, km/h, km, m, kcal, %
// (with a space before %, as in English: "75 %").
import { pluralEn, pluralPl } from '../i18n.svelte'

export const en = {
  appName: 'Cyclotron',
  actions: {
    ride: 'Ride',
    edit: 'Edit',
    duplicate: 'Duplicate',
    delete: 'Delete',
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    import: 'Import',
    export: 'Export',
    search: 'Search',
    start: 'Start',
    pause: 'Pause',
    resume: 'Resume',
    skip: 'Skip',
    end: 'End',
    retry: 'Try again',
    addFavourite: 'Add to favourites',
    removeFavourite: 'Remove from favourites',
  },
  favourites: 'Favourites',
  level: (d: string) => `Level ${d}`,
  /** "3 of 47" */
  countOf: (shown: number, total: number) => `${shown} of ${total}`,
  workoutTypes: {
    recovery: 'Recovery',
    endurance: 'Endurance',
    tempo: 'Tempo',
    sweetspot: 'Sweet Spot',
    threshold: 'Threshold',
    vo2max: 'VO2max',
    anaerobic: 'Anaerobic',
  },
  /** Coggan zones Z1…Z7. */
  powerZones: [
    'Recovery',
    'Endurance',
    'Tempo',
    'Threshold',
    'VO2max',
    'Anaerobic',
    'Neuromuscular',
  ],
  /** Heart-rate zones Z1…Z5. */
  hrZones: ['Recovery', 'Endurance', 'Tempo', 'Threshold', 'Maximum'],
  rides: (n: number) => pluralEn(n, 'ride', 'rides'),
  workouts: (n: number) => pluralEn(n, 'workout', 'workouts'),
  routes: (n: number) => pluralEn(n, 'route', 'routes'),
  /** One workout step, as in "Ramp 50 % → 75 %". */
  segments: {
    steady: 'Steady',
    ramp: 'Ramp',
    freeride: 'Free ride',
    maxeffort: 'Max effort',
    testEffort: 'Test effort: as hard as you can hold evenly',
  },
  /** Errors from core parsers, by code. */
  errors: {
    notZwo: 'not a .zwo workout',
    notCycling: 'not a cycling workout',
    noSteps: 'the workout has no steps',
    notGpx: 'not a GPX file',
    noPoints: 'the GPX file has no track or route points',
    routeTooShort: 'the route is too short',
    notFit: 'not a FIT file',
    noRecords: 'no data records in the file',
    noBluetooth:
      'Bluetooth is off or not available. Turn it on (on Linux: check that BlueZ is installed and running) and try again.',
  },
}

export const pl: typeof en = {
  appName: 'Cyclotron',
  actions: {
    ride: 'Jedź',
    edit: 'Edytuj',
    duplicate: 'Duplikuj',
    delete: 'Usuń',
    cancel: 'Anuluj',
    close: 'Zamknij',
    save: 'Zapisz',
    import: 'Importuj',
    export: 'Eksportuj',
    search: 'Szukaj',
    start: 'Start',
    pause: 'Pauza',
    resume: 'Wznów',
    skip: 'Pomiń',
    end: 'Zakończ',
    retry: 'Spróbuj ponownie',
    addFavourite: 'Dodaj do ulubionych',
    removeFavourite: 'Usuń z ulubionych',
  },
  favourites: 'Ulubione',
  level: (d: string) => `Poziom ${d}`,
  countOf: (shown: number, total: number) => `${shown} z ${total}`,
  workoutTypes: {
    recovery: 'Regeneracja',
    endurance: 'Wytrzymałość',
    tempo: 'Tempo',
    sweetspot: 'Sweet Spot',
    threshold: 'Próg',
    vo2max: 'VO2max',
    anaerobic: 'Beztlenowy',
  },
  powerZones: [
    'Regeneracja',
    'Wytrzymałość',
    'Tempo',
    'Próg',
    'VO2max',
    'Beztlenowa',
    'Nerwowo-mięśniowa',
  ],
  hrZones: ['Regeneracja', 'Wytrzymałość', 'Tempo', 'Próg', 'Maksymalna'],
  rides: (n: number) => pluralPl(n, 'jazda', 'jazdy', 'jazd'),
  workouts: (n: number) => pluralPl(n, 'trening', 'treningi', 'treningów'),
  routes: (n: number) => pluralPl(n, 'trasa', 'trasy', 'tras'),
  segments: {
    steady: 'Stała moc',
    ramp: 'Rampa',
    freeride: 'Jazda swobodna',
    maxeffort: 'Maksymalny wysiłek',
    testEffort: 'Wysiłek testowy: tak mocno, jak utrzymasz równo',
  },
  errors: {
    notZwo: 'to nie jest trening .zwo',
    notCycling: 'to nie jest trening kolarski',
    noSteps: 'trening nie ma żadnych kroków',
    notGpx: 'to nie jest plik GPX',
    noPoints: 'plik GPX nie zawiera punktów trasy',
    routeTooShort: 'trasa jest za krótka',
    notFit: 'to nie jest plik FIT',
    noRecords: 'plik nie zawiera danych',
    noBluetooth:
      'Bluetooth jest wyłączony lub niedostępny. Włącz go (w Linuksie: sprawdź, czy BlueZ jest zainstalowany i uruchomiony) i spróbuj ponownie.',
  },
}
