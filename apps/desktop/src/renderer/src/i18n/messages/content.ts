// Built-in content in other languages, by id (E15-4): workouts (incl. FTP tests and the player
// test) and routes. English comes from core; a missing entry falls back to it. Imported workouts
// and routes are shown as written.

export interface ContentText {
  name?: string
  description?: string
}

export const en = {
  workouts: {} as Record<string, ContentText>,
  routes: {} as Record<string, ContentText>,
}

export const pl: typeof en = {
  workouts: {
    // Recovery
    'builtin.recovery.20': {
      name: 'Luźne 20',
      description: 'Dwadzieścia minut lekkiego kręcenia.',
    },
    'builtin.recovery.30': {
      name: 'Kręcenie regeneracyjne',
      description: 'Trzydzieści luźnych minut na rozruszanie nóg.',
    },
    'builtin.recovery.45': {
      name: 'Regeneracja z przyspieszeniami kadencji',
      description: 'Luźna jazda z minutą szybkiej kadencji co kilka minut. Moc trzymaj nisko.',
    },
    'builtin.recovery.60': { name: 'Luźna godzina', description: 'Pełna godzina, cała na luzie.' },

    // Endurance
    'builtin.endurance.45': { name: 'Wytrzymałość 45', description: 'Krótka jazda w strefie 2.' },
    'builtin.endurance.60': {
      name: 'Godzina wytrzymałości',
      description: 'Równa strefa 2 z krótkimi podbiciami kadencji, żeby nie zasnąć.',
    },
    'builtin.endurance.cadence': {
      name: 'Budowanie kadencji',
      description: 'Strefa 2 z kadencją rosnącą od 85 do 115 rpm. Ta sama moc, szybsze nogi.',
    },
    'builtin.endurance.75': {
      name: 'Wytrzymałość z tempem',
      description: 'Strefa 2 z trzema 5-minutowymi wstawkami tempa.',
    },
    'builtin.endurance.bursts': {
      name: 'Wytrzymałość ze zrywami',
      description: 'Godzina w strefie 2 z 10-sekundowym zrywem co dziesięć minut.',
    },
    'builtin.endurance.90': {
      name: 'Wytrzymałość 90',
      description: 'Dziewięćdziesiąt minut równej strefy 2.',
    },
    'builtin.endurance.120': {
      name: 'Długa wytrzymałość',
      description: 'Dwie godziny w strefie 2 z kilkoma krótkimi podbiciami.',
    },
    'builtin.endurance.180': {
      name: 'Wytrzymałość 3 h',
      description: 'Ten długi. Jedz i pij po drodze.',
    },

    // Tempo
    'builtin.tempo.3x10': {
      name: 'Tempo 3×10',
      description: 'Trzy 10-minutowe bloki w mocnym, równym tempie.',
    },
    'builtin.tempo.2x20': { name: 'Tempo 2×20', description: 'Dwa 20-minutowe bloki tempa.' },
    'builtin.tempo.45': {
      name: 'Tempo 45',
      description: 'Jeden 45-minutowy blok tempa bez przerwy.',
    },
    'builtin.tempo.cadence': {
      name: 'Piramida kadencji w tempie',
      description: 'Dwa 25-minutowe bloki tempa, kadencja rośnie 80 → 100 → 80 rpm.',
    },
    'builtin.tempo.3x20': {
      name: 'Tempo 3×20',
      description: 'Trzy 20-minutowe bloki tempa: duży dzień tlenowy.',
    },

    // Sweet spot
    'builtin.sweetspot.4x8': {
      name: 'Sweet Spot ekspres',
      description: 'Cztery 8-minutowe wysiłki sweet spot w niecałą godzinę.',
    },
    'builtin.sweetspot.2x15': {
      name: 'Sweet Spot 2×15',
      description: 'Dwa 15-minutowe wysiłki sweet spot.',
    },
    'builtin.sweetspot.3x12': {
      name: 'Sweet Spot 3×12',
      description: 'Trzy 12-minutowe bloki tuż poniżej progu.',
    },
    'builtin.sweetspot.4x10': {
      name: 'Sweet Spot 4×10',
      description: 'Cztery 10-minutowe wysiłki sweet spot.',
    },
    'builtin.sweetspot.surges': {
      name: 'Sweet Spot z podbiciami',
      description: 'Bloki sweet spot z 30-sekundowym podbiciem do FTP co trzy minuty.',
    },
    'builtin.sweetspot.2x20': {
      name: 'Sweet Spot 2×20',
      description: 'Dwa 20-minutowe wysiłki sweet spot.',
    },
    'builtin.sweetspot.3x15': {
      name: 'Sweet Spot 3×15',
      description: 'Trzy 15-minutowe wysiłki sweet spot.',
    },
    'builtin.sweetspot.45': {
      name: 'Sweet Spot 45',
      description: 'Jeden 45-minutowy blok sweet spot.',
    },
    'builtin.sweetspot.3x20': {
      name: 'Sweet Spot 3×20',
      description: 'Trzy 20-minutowe wysiłki w górnej części sweet spot.',
    },

    // Threshold
    'builtin.threshold.3x10': {
      name: 'Próg 3×10',
      description: 'Trzy 10-minutowe wysiłki na FTP.',
    },
    'builtin.threshold.overunders': {
      name: 'Over-Under',
      description: 'Trzy 9-minutowe bloki na zmianę tuż poniżej i tuż powyżej FTP.',
    },
    'builtin.threshold.5x6': {
      name: 'Próg 5×6',
      description: 'Pięć 6-minutowych wysiłków lekko powyżej FTP.',
    },
    'builtin.threshold.2x15': {
      name: 'Próg 2×15',
      description: 'Dwa 15-minutowe wysiłki na FTP.',
    },
    'builtin.threshold.4x8': {
      name: 'Próg 4×8',
      description: 'Cztery 8-minutowe wysiłki dokładnie na FTP.',
    },
    'builtin.threshold.2x20': {
      name: 'Próg 2×20',
      description: 'Klasyk: dwa 20-minutowe wysiłki na FTP.',
    },
    'builtin.threshold.3x15': {
      name: 'Próg 3×15',
      description: 'Trzy 15-minutowe wysiłki na FTP.',
    },
    'builtin.threshold.40': {
      name: 'Próg 40',
      description: 'Czterdzieści minut bez przerwy na FTP.',
    },

    // VO2max
    'builtin.vo2max.40-20': {
      description: 'Dwie serie po osiem 40-sekundowych wysiłków z 20 sekundami luzu.',
    },
    'builtin.vo2max.30-30': {
      description: 'Dwie serie po dziesięć 30-sekundowych wysiłków z 30 sekundami luzu.',
    },
    'builtin.vo2max.4x4': {
      description: 'Cztery 4-minutowe wysiłki z równie długą regeneracją.',
    },
    'builtin.vo2max.8x2': {
      description: 'Osiem 2-minutowych wysiłków z równie długą regeneracją.',
    },
    'builtin.vo2max.3x6': {
      name: 'Długie VO2 3×6',
      description: 'Trzy długie 6-minutowe wysiłki tuż powyżej FTP.',
    },
    'builtin.vo2max.5x3': {
      description: 'Pięć mocnych 3-minutowych wysiłków z równie długą regeneracją.',
    },
    'builtin.vo2max.6x3': {
      description: 'Sześć mocnych 3-minutowych wysiłków z równie długą regeneracją.',
    },
    'builtin.vo2max.5x4': {
      description: 'Pięć 4-minutowych wysiłków z równie długą regeneracją.',
    },

    // Anaerobic
    'builtin.anaerobic.sprints': {
      name: 'Sesja sprinterska',
      description: 'Osiem 20-sekundowych sprintów z długą regeneracją. Każdy na maksa.',
    },
    'builtin.anaerobic.tabata': {
      name: 'Serie Tabata',
      description: 'Dwie serie po osiem 20-sekundowych wysiłków z 10 sekundami odpoczynku.',
    },
    'builtin.anaerobic.10x30': {
      name: '30-sekundowe strzały',
      description: 'Dziesięć 30-sekundowych wysiłków wyraźnie powyżej VO2max.',
    },
    'builtin.anaerobic.5x90': {
      name: 'Beztlenowy 5×90 s',
      description: 'Pięć 90-sekundowych wysiłków. Ostatnie 30 sekund każdego będzie bolało.',
    },
    'builtin.anaerobic.8x1': {
      name: 'Beztlenowy 8×1',
      description: 'Osiem 1-minutowych wysiłków na 130 %.',
    },

    // FTP tests, player test, free ride
    'builtin.ftp.ramp': {
      name: 'Test FTP: rampa',
      description:
        'Rozgrzewka 5 minut, potem cel rośnie co minutę, aż nie dasz rady go utrzymać. ' +
        'Trzymaj wysoką kadencję i jedź do odcięcia; test kończy się sam, gdy moc spadnie. ' +
        'FTP = 75 % twojej najlepszej mocy 1-minutowej. Około 20–30 minut.',
    },
    'builtin.ftp.20min': {
      name: 'Test FTP: 20 minut',
      description:
        'Rozgrzewka z przyspieszeniami i 5-minutowym mocnym wysiłkiem, regeneracja, potem ' +
        '20 minut tak mocno, jak utrzymasz równo (ERG wyłączony: reguluj przełożeniami). ' +
        'FTP = 95 % średniej z 20 minut.',
    },
    'builtin.test.short': {
      name: 'Test odtwarzacza',
      description: 'Krótkie kroki do sprawdzenia odtwarzacza i zmian ERG.',
    },
    freeride: { name: 'Jazda swobodna' },
  },
  routes: {
    'builtin:alpe-dhuez': {
      description: '21 agrafek z Le Bourg-d’Oisans, klasyk Tour de France.',
    },
    'builtin:ventoux-bedoin': {
      description:
        'Gigant Prowansji od strony Bédoin: las, Chalet Reynard, a potem nagi, księżycowy krajobraz.',
    },
    'builtin:stelvio-prato': {
      description: '48 numerowanych agrafek z Prato allo Stelvio na wysokość 2757 m.',
    },
    'builtin:tourmalet-luz': {
      description:
        'Zachodnia strona przez Barèges; najczęściej pokonywana przełęcz w historii Touru.',
    },
    'builtin:annecy-loop': {
      name: 'Pętla wokół Jeziora Annecy',
      description:
        'Pagórkowate okrążenie jeziora. Dobre na długie jazdy wytrzymałościowe i treningi.',
    },
    'builtin:tourmalet-sainte-marie': {
      description: 'Wschodnia strona obok La Mongie, z metą przy pomniku Octave’a Lapize’a.',
    },
    'builtin:stelvio-bormio': {
      description: 'Strona Giro: galerie, agrafki Spondalunga i rozwidlenie na Umbrail.',
    },
    'builtin:galibier-valloire': {
      description: 'Z Valloire przez Plan Lachat na 2642 m, przez szczyt, a nie tunelem.',
    },
    'builtin:izoard-briancon': {
      description: 'Doliną Cerveyrette i przez modrzewie do obelisku na Izoard.',
    },
    'builtin:gavia-bormio': {
      description: 'Długi, dziki podjazd przez Santa Caterina Valfurva do jeziora na 2621 m.',
    },
    'builtin:mortirolo-mazzo': {
      description: 'Podjazd Pantaniego: bezlitosne, dwucyfrowe nachylenia w lesie nad Mazzo.',
    },
    'builtin:giau-selva': {
      description: '29 agrafek przy równych 9 % na jedną z najpiękniejszych przełęczy Dolomitów.',
    },
    'builtin:zoncolan-ovaro': {
      description: 'Jeden z najtrudniejszych podjazdów w Europie: 10 km przy prawie 12 %.',
    },
    'builtin:angliru': {
      description: 'Potwór Vuelty w Asturii, z 23,5 % na Cueña les Cabres tuż pod szczytem.',
    },
    'builtin:sa-calobra': {
      name: 'Sa Calobra (Majorka)',
      description: 'Wąż: od morza w górę przez Nus de sa Corbata do Coll dels Reis.',
    },
    'builtin:formentor': {
      name: 'Cap de Formentor (Majorka)',
      description: 'Pagórkowata nadmorska droga z Port de Pollença aż do latarni morskiej.',
    },
    'builtin:champs-elysees': {
      name: 'Rundy na Polach Elizejskich (Paryż)',
      description: 'Ostatnie okrążenia Touru: pod Łuk Triumfalny i z powrotem. Płasko i szybko.',
    },
    'builtin:afsluitdijk': {
      name: 'Afsluitdijk (Holandia)',
      description:
        '30-kilometrowa tama morska między IJsselmeer a Morzem Wattowym. Idealnie płasko; uważaj na wiatr.',
    },
    'builtin:belgian-coast': {
      name: 'Wybrzeże Belgii (De Panne – Blankenberge)',
      description:
        'Około 55 km wzdłuż Morza Północnego przez nadmorskie miejscowości, obok Ostendy. Płasko i równo.',
    },
    'builtin:regents-park': {
      name: 'Regent’s Park Outer Circle (Londyn)',
      description:
        'Klasyczna londyńska pętla treningowa: 4,4 km, prawie płasko, okrążenie za okrążeniem.',
    },
    'builtin:strandvejen': {
      name: 'Strandvejen (Kopenhaga – Helsingør)',
      description:
        'Nadmorska droga na północ od Kopenhagi wzdłuż Sundu. Płasko z łagodnymi pagórkami.',
    },
    'builtin:alcudia-bay': {
      name: 'Zatoka Alcúdia (Majorka)',
      description:
        'Z Port d’Alcúdia do Son Serra de Marina wzdłuż zatoki. Płasko, szybko i słonecznie.',
    },
  },
}
