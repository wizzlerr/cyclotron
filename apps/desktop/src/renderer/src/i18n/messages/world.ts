// Strings for the virtual world (E16). See common.ts for the glossary; `pl` must match `en`.

export const en = {
  label: 'Virtual world',
  toggle: 'World',
  toggleOn: 'Hide the virtual world',
  toggleOff: 'Show the virtual world',
  failed: (why: string) => `The virtual world couldn't start: ${why}`,
  settings: {
    title: 'Virtual world',
    show: 'Show the virtual world on the Ride screen',
    quality: 'Quality',
    high: 'High',
    low: 'Low (older or slower computers)',
    help: 'A simple 3D view of you on the road, following the route or a straight road. Off by default: the numbers are the main thing. It never affects the trainer or the recording.',
  },
}

export const pl: typeof en = {
  label: 'Wirtualny świat',
  toggle: 'Świat',
  toggleOn: 'Ukryj wirtualny świat',
  toggleOff: 'Pokaż wirtualny świat',
  failed: (why: string) => `Nie udało się uruchomić wirtualnego świata: ${why}`,
  settings: {
    title: 'Wirtualny świat',
    show: 'Pokazuj wirtualny świat na ekranie jazdy',
    quality: 'Jakość',
    high: 'Wysoka',
    low: 'Niska (starsze lub wolniejsze komputery)',
    help: 'Prosty widok 3D: ty na drodze, wzdłuż trasy albo po prostej. Domyślnie wyłączony: najważniejsze są liczby. Nie wpływa na trenażer ani na zapis jazdy.',
  },
}
