// Generates the built-in routes (E13-7) from open data:
//   - road geometry: OpenStreetMap, routed with the public OSRM demo server (© OpenStreetMap
//     contributors, ODbL 1.0)
//   - elevation: EU-DEM v1.1 via OpenTopoData (produced using Copernicus data and information
//     funded by the European Union)
// Usage: node scripts/build-routes.mjs [route-id …]  →  packages/core/src/route/builtin-routes.json
// With ids, only those routes are fetched; the others keep their points from the existing file.
// Both services are rate-limited; this makes a few dozen requests, about one per second.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../packages/core/src/route/builtin-routes.json',
)
const ATTRIBUTION =
  'Road data © OpenStreetMap contributors (ODbL). Elevation: EU-DEM v1.1, produced using Copernicus data and information funded by the European Union.'
const STEP_M = 25
// OSRM servers: the project demo (car) and FOSSGIS (bike: follows park roads and one-ways the
// way a cyclist rides them).
const ROUTERS = {
  car: 'https://router.project-osrm.org',
  bike: 'https://routing.openstreetmap.de/routed-bike',
}

// Waypoints are [lat, lon]; enough of them to keep the router on the classic road.
// gradeCapPct: about the real maximum; the 25 m elevation model makes hairpins look steeper.
const ROUTES = [
  {
    id: 'builtin:alpe-dhuez',
    gradeCapPct: 12,
    name: "Alpe d'Huez",
    description: 'The 21 hairpins from Le Bourg-d’Oisans, the Tour de France classic.',
    waypoints: [
      [45.0587, 6.0386],
      [45.0918, 6.0699],
    ],
  },
  {
    id: 'builtin:ventoux-bedoin',
    gradeCapPct: 12,
    name: 'Mont Ventoux (Bédoin)',
    description:
      'The Giant of Provence from Bédoin: forest, Chalet Reynard, then the bare moonscape.',
    waypoints: [
      [44.1244, 5.1797],
      [44.1741, 5.2787],
    ],
  },
  {
    id: 'builtin:stelvio-prato',
    gradeCapPct: 12,
    name: 'Passo dello Stelvio (Prato)',
    description: '48 numbered hairpins from Prato allo Stelvio up to 2757 m.',
    waypoints: [
      [46.6197, 10.5925],
      [46.5287, 10.4527],
    ],
  },
  {
    id: 'builtin:tourmalet-luz',
    gradeCapPct: 12,
    name: 'Col du Tourmalet (Luz-Saint-Sauveur)',
    description: 'The western side through Barèges, the most-climbed pass in Tour history.',
    waypoints: [
      [42.873, -0.0025],
      [42.9086, 0.1453],
    ],
  },
  {
    id: 'builtin:annecy-loop',
    gradeCapPct: 10,
    name: "Lac d'Annecy loop",
    description: 'A rolling lap of the lake. Good for long endurance rides and workouts.',
    waypoints: [
      [45.8992, 6.1294],
      [45.864, 6.14],
      [45.827, 6.203],
      [45.778, 6.224],
      [45.84, 6.213],
      [45.884, 6.17],
      [45.8992, 6.1294],
    ],
  },
  {
    id: 'builtin:tourmalet-sainte-marie',
    gradeCapPct: 12,
    name: 'Col du Tourmalet (Sainte-Marie-de-Campan)',
    description: 'The eastern side past La Mongie, finishing at the statue of Octave Lapize.',
    waypoints: [
      [42.9862, 0.2259],
      [42.9086, 0.1453],
    ],
  },
  {
    id: 'builtin:stelvio-bormio',
    gradeCapPct: 14,
    name: 'Passo dello Stelvio (Bormio)',
    description: 'The Giro side: galleries, the Spondalunga hairpins and the Umbrail junction.',
    waypoints: [
      [46.4671, 10.3707],
      [46.5287, 10.4527],
    ],
  },
  {
    id: 'builtin:galibier-valloire',
    gradeCapPct: 12,
    name: 'Col du Galibier (Valloire)',
    description:
      'From Valloire through Plan Lachat to 2642 m, over the top rather than the tunnel.',
    waypoints: [
      [45.1653, 6.4293],
      [45.0641, 6.4079],
    ],
  },
  {
    id: 'builtin:izoard-briancon',
    gradeCapPct: 12,
    name: "Col d'Izoard (Briançon)",
    description: 'Up the Cerveyrette valley and through the larches to the Izoard obelisk.',
    waypoints: [
      [44.8987, 6.6436],
      [44.8203, 6.7351],
    ],
  },
  {
    id: 'builtin:gavia-bormio',
    gradeCapPct: 16,
    name: 'Passo di Gavia (Bormio)',
    description: 'A long, wild climb through Santa Caterina Valfurva to the lake at 2621 m.',
    waypoints: [
      [46.4671, 10.3707],
      [46.3436, 10.4876],
    ],
  },
  {
    id: 'builtin:mortirolo-mazzo',
    gradeCapPct: 18,
    name: 'Passo del Mortirolo (Mazzo)',
    description: "Pantani's climb: relentless double-digit grades in the woods above Mazzo.",
    waypoints: [
      [46.2564, 10.2551],
      [46.2486, 10.2978],
    ],
  },
  {
    id: 'builtin:giau-selva',
    gradeCapPct: 14,
    name: 'Passo Giau (Selva di Cadore)',
    description: "29 hairpins at a steady 9 % to one of the Dolomites' most spectacular passes.",
    waypoints: [
      [46.4467, 12.0356],
      [46.4823, 12.0539],
    ],
  },
  {
    id: 'builtin:zoncolan-ovaro',
    gradeCapPct: 22,
    name: 'Monte Zoncolan (Ovaro)',
    description: 'One of the hardest climbs in Europe: 10 km at nearly 12 %.',
    waypoints: [
      [46.4835, 12.8644],
      [46.5005, 12.9268],
    ],
  },
  {
    id: 'builtin:angliru',
    gradeCapPct: 24,
    name: "Alto de l'Angliru",
    description: "The Vuelta's monster in Asturias, with the 23.5 % Cueña les Cabres near the top.",
    waypoints: [
      [43.228, -5.881],
      [43.2215, -5.9369],
    ],
  },
  {
    id: 'builtin:sa-calobra',
    gradeCapPct: 12,
    name: 'Sa Calobra (Mallorca)',
    description: 'The snake: from the sea up through the Nus de sa Corbata to Coll dels Reis.',
    waypoints: [
      [39.8513, 2.8075],
      [39.8338, 2.8243],
    ],
  },
  {
    id: 'builtin:formentor',
    gradeCapPct: 12,
    name: 'Cap de Formentor (Mallorca)',
    description: 'Rolling coast road from Port de Pollença out to the lighthouse.',
    waypoints: [
      [39.9077, 3.0838],
      [39.9619, 3.2117],
    ],
  },
  {
    id: 'builtin:champs-elysees',
    gradeCapPct: 6,
    name: 'Champs-Élysées circuit (Paris)',
    description: "The Tour's final laps: up to the Arc de Triomphe and back. Flat and fast.",
    waypoints: [
      [48.8656, 2.3212],
      [48.8738, 2.295],
      [48.8628, 2.3283],
      [48.8656, 2.3212],
    ],
  },
  {
    id: 'builtin:afsluitdijk',
    gradeCapPct: 4,
    name: 'Afsluitdijk (Netherlands)',
    description:
      'The 30 km sea dike between the IJsselmeer and the Wadden Sea. Dead flat; mind the wind.',
    waypoints: [
      [52.9353, 5.0397],
      [53.0716, 5.3317],
      [53.1036, 5.3897],
    ],
  },
  {
    id: 'builtin:belgian-coast',
    gradeCapPct: 6,
    name: 'Belgian coast (De Panne – Blankenberge)',
    description:
      'About 55 km along the North Sea through the seaside towns, past Ostend. Flat and steady.',
    waypoints: [
      [51.101, 2.59],
      [51.116, 2.64],
      [51.131, 2.75],
      [51.185, 2.82],
      [51.229, 2.915],
      [51.25, 2.97],
      [51.273, 3.033],
      [51.296, 3.08],
      [51.312, 3.132],
    ],
  },
  {
    id: 'builtin:regents-park',
    gradeCapPct: 5,
    router: 'bike',
    name: "Regent's Park Outer Circle (London)",
    description: "London's classic training loop: 4.4 km, almost flat, lap after lap.",
    // Points on the Outer Circle itself (from OpenStreetMap), anticlockwise from Park Square.
    waypoints: [
      [51.5251882, -0.1462143],
      [51.5289515, -0.1458415],
      [51.5309636, -0.1462329],
      [51.5341173, -0.1476321],
      [51.536252, -0.1494911],
      [51.5365324, -0.1527151],
      [51.5351541, -0.1585976],
      [51.534056, -0.1626518],
      [51.5323717, -0.1643236],
      [51.5288394, -0.1638464],
      [51.5276581, -0.1619395],
      [51.5252247, -0.1590001],
      [51.5244825, -0.1578264],
      [51.5237046, -0.1547437],
      [51.5240751, -0.1526339],
      [51.5246134, -0.1495224],
      [51.5248452, -0.1482062],
      [51.5251882, -0.1462143],
    ],
  },
  {
    id: 'builtin:strandvejen',
    gradeCapPct: 8,
    name: 'Strandvejen (Copenhagen – Helsingør)',
    description:
      'The coast road north from Copenhagen along the Øresund. Flat with gentle rollers.',
    waypoints: [
      [55.733, 12.579],
      [55.77, 12.593],
      [55.823, 12.575],
      [55.853, 12.568],
      [55.884, 12.545],
      [55.964, 12.537],
      [56.031, 12.6],
    ],
  },
  {
    id: 'builtin:alcudia-bay',
    gradeCapPct: 6,
    name: 'Bay of Alcúdia (Mallorca)',
    description: "Port d'Alcúdia to Son Serra de Marina along the bay. Flat, fast and sunny.",
    waypoints: [
      [39.84, 3.13],
      [39.768, 3.158],
      [39.733, 3.22],
    ],
  },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getJson(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'cyclotron-build-routes' } })
    if (res.ok) return res.json()
    if (attempt >= 3) throw new Error(`${res.status} ${res.statusText}: ${url}`)
    await sleep(2000 * (attempt + 1))
  }
}

function haversineM(a, b) {
  const rad = Math.PI / 180
  const dLat = (b[0] - a[0]) * rad
  const dLon = (b[1] - a[1]) * rad
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6_371_008.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Points every `step` metres along the polyline (plus the end). */
function resample(line, step) {
  const out = [line[0]]
  let carry = 0
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]
    const b = line[i]
    const seg = haversineM(a, b)
    let at = step - carry
    while (at <= seg) {
      const f = at / seg
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f])
      at += step
    }
    carry = seg - (at - step)
  }
  const last = line.at(-1)
  if (haversineM(out.at(-1), last) > 1) out.push(last)
  return out
}

async function build(route) {
  const coords = route.waypoints.map(([lat, lon]) => `${lon},${lat}`).join(';')
  const osrm = await getJson(
    `${ROUTERS[route.router ?? 'car']}/route/v1/driving/${coords}?overview=full&geometries=geojson`,
  )
  if (osrm.code !== 'Ok') throw new Error(`OSRM: ${osrm.code} for ${route.name}`)
  const line = osrm.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon])
  const points = resample(line, STEP_M)

  const ele = []
  for (let i = 0; i < points.length; i += 100) {
    const batch = points.slice(i, i + 100)
    const locs = batch.map(([lat, lon]) => `${lat.toFixed(6)},${lon.toFixed(6)}`).join('|')
    const res = await getJson(`https://api.opentopodata.org/v1/eudem25m?locations=${locs}`)
    for (const r of res.results) ele.push(r.elevation ?? ele.at(-1) ?? 0)
    await sleep(1100)
  }

  const triples = points.map(([lat, lon], i) => [
    Math.round(lat * 1e6) / 1e6,
    Math.round(lon * 1e6) / 1e6,
    Math.round(ele[i] * 10) / 10,
  ])
  const km = (osrm.routes[0].distance / 1000).toFixed(1)
  console.log(
    `${route.name}: ${km} km, ${triples.length} points, ${triples[0][2]} → ${triples.at(-1)[2]} m`,
  )
  const meta = { ...route }
  delete meta.waypoints
  delete meta.router
  return { ...meta, attribution: ATTRIBUTION, points: triples }
}

const only = process.argv.slice(2)
for (const id of only) {
  if (!ROUTES.some((r) => r.id === id)) throw new Error(`unknown route ${id}`)
}
const existing = new Map(
  only.length > 0 ? JSON.parse(readFileSync(OUT, 'utf8')).map((r) => [r.id, r]) : [],
)
const routes = []
for (const r of ROUTES) {
  const kept = existing.get(r.id)
  if (kept && !only.includes(r.id)) {
    // Name, description or cap may have changed; the points stay.
    const meta = { ...r }
    delete meta.waypoints
    delete meta.router
    routes.push({ ...meta, attribution: ATTRIBUTION, points: kept.points })
    continue
  }
  routes.push(await build(r))
  await sleep(1100)
}
writeFileSync(OUT, JSON.stringify(routes) + '\n')
console.log(`wrote ${OUT}`)
