// Strings for recommendations (E11): the Today card, training settings, levels. See common.ts for
// the glossary; `pl` must match `en` key for key.
import type { Goal, Readiness } from '@cyclotron/core'
import { pluralEn, pluralPl } from '../i18n.svelte'

export const en = {
  today: 'Today',
  loading: 'Working out what to ride…',
  failed: (why: string) => `Couldn't load your recommendation: ${why}`,
  readiness: {
    fresh: 'Fresh',
    normal: 'Normal',
    fatigued: 'Fatigued',
    very_fatigued: 'Very fatigued',
  } satisfies Record<Readiness, string>,
  form: (tsb: string) => `form ${tsb}`,
  timeLabel: 'Time today',
  minutes: (m: number) => `${m} min`,
  restTitle: 'Rest day',
  restRide: 'If you still want to ride:',
  recommended: 'Recommended',
  easier: 'Easier',
  shorter: 'Shorter',
  why: 'Why',
  nothing: 'No workout fits this time. Try more time, or ride freely.',
  /** Reason codes from core, worded. */
  reasons: {
    readiness: (r: Readiness, tsb: string) =>
      ({
        fresh: `You're fresh (form ${tsb}): a good day for a harder session.`,
        normal: `Your form is ${tsb}: normal training load.`,
        fatigued: `You're carrying fatigue (form ${tsb}): keep it easy today.`,
        very_fatigued: `You're very fatigued (form ${tsb}): rest helps you more than training.`,
      })[r],
    hardYesterday: 'You rode hard yesterday.',
    twoHardDays: 'Two hard days in a row: time to back off.',
    recentFail: "A recent workout didn't go to plan, so today is a little easier.",
    signal: (source: string, shift: number) =>
      source === 'restingHr'
        ? 'Garmin: your resting heart rate is above your usual.'
        : source === 'bodyBattery'
          ? shift < 0
            ? 'Garmin: your Body Battery is low this morning.'
            : 'Garmin: your Body Battery is well charged.'
          : source === 'sleep'
            ? 'Garmin: short sleep last night.'
            : shift < 0
              ? `${source}: less recovered than usual.`
              : `${source}: well recovered.`,
    goal: (goal: Goal, type: string) =>
      ({
        fitness: `${type} builds general fitness.`,
        ftp: `${type} work raises your FTP.`,
        endurance: `${type} builds your endurance.`,
        vo2: `${type} work raises your top-end power.`,
      })[goal],
    tooMuchIntensity: (pct: number) =>
      `${pct} % of this week's time was at tempo or harder: balancing with easier riding (80/20).`,
    roomForIntensity: (pct: number) =>
      `Only ${pct} % of this week's time was at tempo or harder: room for some intensity.`,
    notDoneFor: (type: string, days: number | null) =>
      days === null
        ? `You haven't done ${type} yet.`
        : `No ${type} for ${pluralEn(days, 'day', 'days')}.`,
    weeklyDone: (hours: string, target: string) =>
      `You've ridden ${hours} h this week, your target is ${target} h.`,
    restDay: "Today isn't one of your training days.",
    planRest: 'Your plan has a rest day today.',
    planHard: (type: string) => `Your plan has a hard day today: ${type}.`,
    planEasy: 'Your plan has an easy day today.',
    planLong: 'Your plan has the long ride today: steady endurance.',
    level: (type: string, level: string, difficulty: string) =>
      `${type} level ${level}: this workout is ${difficulty}.`,
    noFit: (type: string, minutes: number) => `No ${type} workout fits in ${minutes} min.`,
  },
  settings: {
    title: 'Training',
    goal: 'Goal',
    goals: {
      fitness: 'General fitness',
      ftp: 'Raise FTP',
      endurance: 'Endurance',
      vo2: 'Top-end power (VO2max)',
    } satisfies Record<Goal, string>,
    weeklyHours: 'Hours per week',
    rideDays: 'Training days',
    anyDay: 'No days ticked: the weekly plan picks them from your hours.',
    /** Sunday first, as Date.getDay(). */
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    hint: 'Used for the recommended workout on Home. Levels go up as you complete workouts; your feedback after a ride tunes them.',
  },
  generated: {
    badge: 'Made for you',
    steady: (span: string, pct: string) =>
      `Made for your level: warm-up, ${span} at ${pct} % FTP, cool-down.`,
    intervals: (count: number, on: string, pct: string, off: string, fill: boolean) =>
      `Made for your level: ${count} × ${on} at ${pct} % FTP with ${off} easy between${fill ? ', then easy riding to use your time' : ''}.`,
  },
  plan: {
    title: 'This week',
    kinds: { rest: 'Rest', easy: 'Easy', hard: 'Hard', long: 'Long' },
    done: 'Done',
    missed: 'Missed',
    extra: 'Extra ride',
    todayTag: 'Today',
    planned: (tss: number, done: number) => `Planned TSS ${tss} · done ${done}`,
    capped: 'Load reduced to keep your fitness rising safely (about +8 a week).',
    defaultDays: 'Training days picked for you. Choose your own in Settings → Training.',
    settings: 'Settings…',
  },
  levels: {
    title: 'Training levels',
    hint: 'Your level per workout type, 1 to 10. Completed workouts raise it, a failed one lowers it, and it slowly drops when you skip a type for weeks.',
  },
}

export const pl: typeof en = {
  today: 'Dzisiaj',
  loading: 'Wybieram trening…',
  failed: (why: string) => `Nie udało się wczytać rekomendacji: ${why}`,
  readiness: {
    fresh: 'Świeże nogi',
    normal: 'Normalnie',
    fatigued: 'Zmęczenie',
    very_fatigued: 'Duże zmęczenie',
  },
  form: (tsb: string) => `forma ${tsb}`,
  timeLabel: 'Czas na dziś',
  minutes: (m: number) => `${m} min`,
  restTitle: 'Dzień odpoczynku',
  restRide: 'Jeśli mimo to chcesz jechać:',
  recommended: 'Polecany',
  easier: 'Łatwiejszy',
  shorter: 'Krótszy',
  why: 'Dlaczego',
  nothing: 'Żaden trening nie mieści się w tym czasie. Wybierz więcej czasu albo jedź swobodnie.',
  reasons: {
    readiness: (r: Readiness, tsb: string) =>
      ({
        fresh: `Masz świeże nogi (forma ${tsb}): dobry dzień na mocniejszy trening.`,
        normal: `Twoja forma to ${tsb}: normalne obciążenie.`,
        fatigued: `Masz w nogach zmęczenie (forma ${tsb}): dziś spokojnie.`,
        very_fatigued: `Duże zmęczenie (forma ${tsb}): odpoczynek da ci więcej niż trening.`,
      })[r],
    hardYesterday: 'Wczoraj był mocny trening.',
    twoHardDays: 'Dwa mocne dni z rzędu: czas zwolnić.',
    recentFail: 'Ostatni trening nie poszedł zgodnie z planem, więc dziś trochę łatwiej.',
    signal: (source: string, shift: number) =>
      source === 'restingHr'
        ? 'Garmin: tętno spoczynkowe wyższe niż zwykle.'
        : source === 'bodyBattery'
          ? shift < 0
            ? 'Garmin: niska Body Battery tego ranka.'
            : 'Garmin: Body Battery dobrze naładowana.'
          : source === 'sleep'
            ? 'Garmin: krótki sen tej nocy.'
            : shift < 0
              ? `${source}: słabsza regeneracja niż zwykle.`
              : `${source}: dobra regeneracja.`,
    goal: (goal: Goal, type: string) =>
      ({
        fitness: `${type} buduje ogólną kondycję.`,
        ftp: `${type} podnosi twoje FTP.`,
        endurance: `${type} buduje wytrzymałość.`,
        vo2: `${type} podnosi twoją moc maksymalną.`,
      })[goal],
    tooMuchIntensity: (pct: number) =>
      `${pct} % czasu w tym tygodniu to tempo lub mocniej: równoważę spokojniejszą jazdą (80/20).`,
    roomForIntensity: (pct: number) =>
      `Tylko ${pct} % czasu w tym tygodniu to tempo lub mocniej: jest miejsce na intensywność.`,
    notDoneFor: (type: string, days: number | null) =>
      days === null
        ? `Nie było jeszcze treningu typu ${type}.`
        : `${type}: ostatnio ${pluralPl(days, 'dzień', 'dni', 'dni')} temu.`,
    weeklyDone: (hours: string, target: string) =>
      `W tym tygodniu masz już ${hours} h jazdy, cel to ${target} h.`,
    restDay: 'Dziś nie jest twój dzień treningowy.',
    planRest: 'W planie na dziś jest odpoczynek.',
    planHard: (type: string) => `W planie na dziś mocny dzień: ${type}.`,
    planEasy: 'W planie na dziś spokojny dzień.',
    planLong: 'W planie na dziś długa jazda: równa wytrzymałość.',
    level: (type: string, level: string, difficulty: string) =>
      `${type}: twój poziom ${level}, ten trening ma ${difficulty}.`,
    noFit: (type: string, minutes: number) =>
      `Żaden trening typu ${type} nie mieści się w ${minutes} min.`,
  },
  settings: {
    title: 'Trening',
    goal: 'Cel',
    goals: {
      fitness: 'Ogólna kondycja',
      ftp: 'Wyższe FTP',
      endurance: 'Wytrzymałość',
      vo2: 'Moc maksymalna (VO2max)',
    },
    weeklyHours: 'Godzin w tygodniu',
    rideDays: 'Dni treningowe',
    anyDay: 'Brak zaznaczonych dni: plan tygodnia dobierze je do twoich godzin.',
    days: ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'],
    hint: 'Na tej podstawie wybieram polecany trening na stronie Start. Poziomy rosną, gdy kończysz treningi; twoja ocena po jeździe je dostraja.',
  },
  generated: {
    badge: 'Na miarę',
    steady: (span: string, pct: string) =>
      `Ułożony pod twój poziom: rozgrzewka, ${span} przy ${pct} % FTP, schłodzenie.`,
    intervals: (count: number, on: string, pct: string, off: string, fill: boolean) =>
      `Ułożony pod twój poziom: ${count} × ${on} przy ${pct} % FTP, ${off} luźno pomiędzy${fill ? ', potem spokojna jazda do końca czasu' : ''}.`,
  },
  plan: {
    title: 'Ten tydzień',
    kinds: { rest: 'Odpoczynek', easy: 'Spokojnie', hard: 'Mocno', long: 'Długa' },
    done: 'Zrobione',
    missed: 'Pominięte',
    extra: 'Dodatkowa jazda',
    todayTag: 'Dziś',
    planned: (tss: number, done: number) => `Plan TSS ${tss} · zrobione ${done}`,
    capped: 'Obciążenie zmniejszone, żeby kondycja rosła bezpiecznie (około +8 na tydzień).',
    defaultDays: 'Dni treningowe dobrane automatycznie. Wybierz własne w Ustawienia → Trening.',
    settings: 'Ustawienia…',
  },
  levels: {
    title: 'Poziomy treningowe',
    hint: 'Twój poziom dla każdego typu treningu, od 1 do 10. Ukończone treningi go podnoszą, nieudany obniża, a gdy przez kilka tygodni pomijasz dany typ, powoli spada.',
  },
}
