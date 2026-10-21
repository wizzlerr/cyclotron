# Cyclotron — Backlog

Single-player indoor training desktop app for Wahoo KICKR. No 3D world, just training metrics.

How everything fits together (architecture, data model, protocols, math, recommendation engine): see [DESIGN.md](DESIGN.md).

**Platforms:** Windows and macOS desktop app (Electron, ships its own Chromium). No hosted web version, so we don't care which browser the user has.

**Architecture:**

```
cyclotron/                (pnpm monorepo, TypeScript everywhere)
  packages/core     ← shared: power math, workout model, FTMS parsing, recommendation logic
  apps/desktop      ← Electron app: UI (Vite renderer), Web Bluetooth, local storage, packaging
  apps/server       ← Node API + SQLite, Docker on Synology DS920+ (added after MVP)
```

**Server budget:** runs on a Synology DS920+ (x86-64 Celeron, ~1 GB RAM free, 2 cores). Target **< 150 MB RAM** for the container, ~0% CPU when idle, all heavy work done once per ride at upload time.

**Rule:** Bluetooth, the workout player and recording always run in the desktop app and must work offline. The server only gets rides after they're finished (sync), and does history, analytics, recommendations and Garmin upload.

**Sizes:** S ≈ ≤ half a day · M ≈ 1–2 days · L ≈ 3+ days

**Auuki reuse:** We reuse the *math* (formulas aren't copyrightable) and use its code as a reference for BLE parsing. Auuki is (I believe) AGPL-3.0, so we don't copy code verbatim unless we accept AGPL for Cyclotron (see E0-6).

---

## E0 — Foundation

| ID | Task | Size |
|---|---|---|
| ~~E0-1~~ | ✅ pnpm monorepo: `packages/core`, `apps/desktop`; shared tsconfig, ESLint/Prettier, Vitest | S |
| ~~E0-2~~ | ✅ Electron + Vite scaffold (main, preload, renderer), dev hot reload, secure defaults (context isolation, no node in renderer) | M |
| ~~E0-3~~ | ✅ App shell: screens (Home, Ride, Workouts, History, Settings) | M |
| E0-4 | Local storage: SQLite in the main process (`better-sqlite3`), exposed to the UI through preload IPC; schema migrations | M |
| E0-5 | User profile: weight, FTP, max HR, FTP history with dates | S |
| E0-6 | Check Auuki license; decide whether to copy code or only reuse the math | S |
| ~~E0-7~~ | ~~Settle UI framework and chart library~~ — done: Svelte 5 + uPlot (DESIGN.md D12, D13) | S |

## E1 — Device connectivity

| ID | Task | Size |
|---|---|---|
| ~~E1-0~~ | ✅ (2026-10-21, FTMS confirmed on fw 3.5.11; findings in DESIGN.md D14) **Spike first:** trainer is a KICKR CORE 2; confirm firmware; in Electron, connect and list its BLE services. Does it have FTMS (`0x1826`) or only Cycling Power + Wahoo proprietary control? Capture real packets for tests | S |
| ~~E1-1~~ | ✅ (2026-10-21, tested on the KICKR) Device picker: handle Electron's `select-bluetooth-device` event and show our own scan list | M |
| ~~E1-2~~ | ✅ (2026-10-21, tested on the KICKR) Connect to KICKR over FTMS: Indoor Bike Data parsing (power, cadence, speed) | M |
| E1-3 | Fallback: Cycling Power Service (0x1818) parsing if FTMS is unavailable (low priority: KICKR CORE 2 has FTMS) | M |
| ~~E1-4~~ | ✅ (2026-10-21, tested; also uses HR relayed by the KICKR) Heart rate strap connection (0x180D / 0x2A37) | S |
| ~~E1-5~~ | ✅ (2026-10-21, reconnect tested; devices remembered by name; one click reconnects because Web Bluetooth needs a user gesture). Connection status UI, auto-reconnect on drop, remember devices. Connect lean: only FTMS + HR services and the characteristics a ride needs (E1-0 saw ~70 s to connect with everything subscribed on Windows) | M |
| ~~E1-6~~ | ✅ Simulated trainer (fake device) for development without hardware | M |

## E2 — Trainer control

| ID | Task | Size |
|---|---|---|
| ~~E2-1~~ | ✅ (2026-10-21, tested on the KICKR) FTMS Control Point: Request Control, Start/Resume, response handling | M |
| ~~E2-2~~ | ✅ (2026-10-21, ERG 150 and 200 W held steady on the KICKR) ERG mode: Set Target Power | S |
| E2-3 | Resistance mode (manual % level) | S |
| E2-4 | Simulation mode: set grade, for "free ride" without ERG | M |
| ~~E2-5~~ | ✅ (2026-10-21, unit-tested; coalesces target changes, re-requests control on "not permitted") Command queue (one in-flight write at a time, retries) | S |
| E2-6 | Spin-down calibration trigger (if exposed by the KICKR) | S |
| ~~E2-7~~ | ~~Fallback: Wahoo proprietary trainer control~~ — not needed: KICKR CORE 2 accepts FTMS control (E1-0) | M |

## E3 — Workout engine and player

| ID | Task | Size |
|---|---|---|
| ~~E3-1~~ | ✅ (2026-10-21) Workout data model in `core`: steps (steady, ramp, intervals, free ride), targets as % FTP | M |
| ~~E3-2~~ | ✅ (2026-10-21) Import Zwift `.zwo` files | M |
| ~~E3-3~~ | ✅ (2026-10-21) Player: timer, step transitions, sends ERG targets, pause/resume/skip | L |
| ~~E3-4~~ | ✅ (2026-10-21) Intensity adjust on the fly (±1–5%) | S |
| ~~E3-5~~ | ✅ (2026-10-21) (SVG, not uPlot) Workout graph (profile chart with current position) | M |
| ~~E3-6~~ | ✅ (2026-10-21) Audio/visual cues before step changes | S |
| ~~E3-7~~ | ✅ (2026-10-21) Keep the system awake during a ride (`powerSaveBlocker`); `backgroundThrottling: false` and drift-corrected 1 Hz tick so a minimized window doesn't slow the player | S |
| E3-8 | Workout builder: create and edit workouts (steps, ramps, repeats, free ride), live profile + stats, save to the library, export `.zwo`. **Scheduled before the server** (user request 2026-10-21) | L |

## E4 — Live metrics dashboard

| ID | Task | Size |
|---|---|---|
| ~~E4-1~~ | ✅ (2026-10-21) Big-number tiles: power (3s/10s avg), HR, cadence, target, elapsed/remaining | M |
| ~~E4-2~~ | ✅ (2026-10-21) (HR zones need max HR in Settings) Power zones (Coggan 7-zone) and HR zones with colored current zone | S |
| ~~E4-3~~ | ✅ (2026-10-21) (`LiveRideMetrics`, equal to the saved summary) Live NP, IF, TSS, kJ, W/kg, average power (math in `core`) | M |
| ~~E4-4~~ | ✅ (2026-10-21) (uPlot; cadence hidden by default, click the legend) Live chart: power/HR/cadence over time | M |
| ~~E4-5~~ | ✅ (2026-10-21) Layout settings: which tiles are shown | S |

## E5 — Ride recording and export

| ID | Task | Size |
|---|---|---|
| ~~E5-1~~ | ✅ (2026-10-21) crash recovery saves or discards the partial ride; resuming the workout itself isn't supported. Record 1 Hz samples to SQLite during a ride; resume after a crash or app restart | M |
| ~~E5-2~~ | ✅ (2026-10-21) Encode `.FIT` activity with `@garmin/fitsdk` (laps per workout step) | M |
| E5-3 | ✅ done 2026-10-21 (a real ride imported cleanly into Garmin Connect; Strava not checked separately). Auto-save FIT to a chosen folder + "Show in folder"; validate import into Garmin Connect and Strava | S |
| ~~E5-4~~ | ✅ (2026-10-21) with laps and feedback (Too easy … Couldn't finish); plus a local ride list on History. Ride summary screen after finishing | M |

## E6 — FTP testing

| ID | Task | Size |
|---|---|---|
| ~~E6-1~~ | ✅ (2026-10-21) 1-min steps +6 % FTP from 50 %; auto-ends (to cooldown) when power < 80 % of target for 10 s or cadence < 40 rpm for 5 s. Ramp test workout + FTP = 75% of best 1-min power | M |
| ~~E6-2~~ | ✅ (2026-10-21) warm-up with openers + 5-min effort, then 20 min ERG off. 20-min test workout + FTP = 95% of 20-min average | S |
| ~~E6-3~~ | ✅ (2026-10-21) FTP history in SQLite, shown in Settings; manual changes logged too. "Accept new FTP?" prompt, store in FTP history | S |

## E7 — Desktop packaging

| ID | Task | Size |
|---|---|---|
| E7-1 | ✅ Windows done 2026-10-21 (`pnpm dist` → `apps/desktop/dist/Cyclotron-Setup-<v>.exe`, packaged app driven end to end); macOS `.dmg` configured (`pnpm dist:mac`), must be built and tried on a Mac. `electron-builder`: Windows installer (NSIS) and macOS `.dmg` | M |
| E7-2 | 🔧 usage description set in `electron-builder.yml`; permission prompt untested (needs a Mac). macOS: Bluetooth usage description (`NSBluetoothAlwaysUsageDescription`), test permission prompt | S |
| E7-3 | ✅ done 2026-10-21 (icon `apps/desktop/build/icon.png`, name "Cyclotron", v0.1.0, Settings → About with "Show data folder"; also: settings moved to SQLite, single instance, D17). App icon, name, version shown in Settings | S |
| E7-4 | Optional: macOS signing + notarization (needs Apple Developer account, $99/yr), Windows code signing | M |
| E7-5 | Optional: auto-update (`electron-updater`, GitHub Releases) | M |

**↑ MVP: ride a workout in ERG mode on Windows/macOS, export FIT, run FTP tests.**

## E8 — Server and sync

**Moved to the end (2026-10-21, user decision):** the desktop does history, analytics, recommendations and Garmin on its own first (E9–E12). The server is then an optional add-on: backup, a second computer, always-on Garmin pulls. It reuses the same `core` code, so nothing is built twice.

| ID | Task | Size |
|---|---|---|
| E8-1 | `apps/server`: Node API (Fastify) + SQLite (`better-sqlite3`, WAL mode) — no separate DB container | M |
| E8-2 | Lean Docker image: multi-stage build, `node:24-alpine`, prod deps only; `docker-compose.yml` for Synology Container Manager with `mem_limit: 256m`, `--max-old-space-size=128`, data on a mounted volume | M |
| E8-3 | Single-user auth: API token generated on the server, entered once in desktop Settings | S |
| E8-4 | Ride upload endpoint: store the FIT file on disk + one summary row; per-second samples are **not** stored as DB rows | M |
| E8-5 | Compute-once on upload: per-ride power curve, zone times, NP/TSS, daily load stored as small aggregate tables, so every later query is a cheap lookup | M |
| E8-6 | Gzip/compression for API responses; paginated history endpoints | S |
| E8-7 | Measure: idle RAM, RAM during upload, upload processing time for a 2 h ride on the NAS; must fit the budget | S |
| E8-8 | Desktop sync queue: upload finished rides when the server is reachable, retry when offline | M |
| E8-9 | Profile/FTP history sync (server is the source of truth, desktop keeps a cache) | M |
| E8-10 | Server URL + connection status in Settings; app still works fully without a server | S |
| E8-11 | Backup: data volume (SQLite file + FIT folder) covered by Synology Hyper Backup; safe SQLite snapshot via `VACUUM INTO` nightly | S |
| E8-12 | Multi-device: download rides made on another computer (summary + FIT → local samples and aggregates); ride deletions as tombstones | M |
| E8-13 | Sync imported workouts, routes and favourites (id + `updated_at`, last write wins, tombstones) | M |
| E8-14 | Online/offline indicator in the sidebar; "Sync now"; sync on start, after each ride and every few minutes while online | S |
| E8-15 | Always-on jobs on the server: daily load/recommendation recompute; Garmin pulls and upload retries move here from the desktop (E12) | M |

## E9 — History and analytics

Runs on the desktop (server comes last, see E8). Aggregates (power curve, zone times, TSS per day) are computed once when a ride finishes and stored in the desktop SQLite; charts that need per-second data (ride detail) read that ride's samples. Core pieces already written: `core/metrics/curve.ts` (power curve, zone times), `core/metrics/load.ts` (CTL/ATL/TSB).

| ID | Task | Size |
|---|---|---|
| E9-1 | ✅ done 2026-10-21. (History: click a ride for detail: stats, power/HR/elevation charts with a synced cursor, power curve, zones, laps, route outline, delete) Ride history list and ride detail view | M |
| E9-2 | ✅ done 2026-10-21. (Progress screen: all time / 90 days / 6 weeks + best-of table with the ride it came from) Power-duration curve (best 5s, 1m, 5m, 20m, 60m), all-time and last 42/90 days | M |
| E9-3 | ✅ done 2026-10-21. (Progress: fitness/fatigue/form chart with ranges, daily TSS bars) Training load: CTL (fitness), ATL (fatigue), TSB (form) chart | M |
| E9-4 | ✅ done 2026-10-21. (per ride: Z1–Z7 bars; per week: easy/moderate/hard stacked bars, 12 weeks) Time in zone per ride and per week | S |
| E9-5 | ✅ done 2026-10-21. (any cycling FIT; copies into <FIT folder>/imported, skips duplicates by start time and non-cycling files, FTP from the file or FTP history) Import existing FIT files (e.g. past rides) to bootstrap history | M |
| E9-6 | ✅ done 2026-10-21. (95 % of best 20 min in 90 days, "Use X W") Auto-detected FTP estimate from history (power curve based) | M |

## E10 — Workout library

Library ships with the desktop app so it works offline.

| ID | Task | Size |
|---|---|---|
| E10-1 | Built-in library: ~30–50 workouts tagged by type (Recovery, Endurance, Tempo, Sweet Spot, Threshold, VO2max, Anaerobic) | L |
| E10-2 | Per-workout metadata: duration, TSS, IF, primary zone, difficulty level (1–10) | M |
| E10-3 | Library browser with filters (type, duration, difficulty) | M |
| E10-4 | Favorites and "done before" markers | S |

## E11 — Recommended workouts ⭐

Zwift-style "what should I ride today?". Logic lives in `core` and runs on the desktop from local rides (the server, when added in E8, can run the same engine). Rule-based first, then adaptive. No ML models: rules + simple scoring keep it fast enough to run in milliseconds on the NAS.

| ID | Task | Size |
|---|---|---|
| E11-1 | Training goal in profile (general fitness / raise FTP / endurance / VO2) and weekly time available | S |
| E11-2 | Readiness from TSB + days since last hard workout (fresh / normal / fatigued) | M |
| E11-3 | Progression levels per zone (like TrainerRoad): level goes up when a workout of that type is completed | L |
| E11-4 | Rule engine: pick workout type from goal, readiness, weekly zone distribution (e.g. 80/20 balance) and what was done recently | L |
| E11-5 | Pick a concrete workout: matches type, fits time available, difficulty ≈ current level (+ small stretch) | M |
| E11-6 | "Today" card on Home: 1 main recommendation + 2 alternatives (easier / shorter), with a short "why" explanation | M |
| E11-7 | Post-ride feedback (Easy / Moderate / Hard / Very hard / Failed) adjusts progression levels | M |
| E11-8 | Detect a failed workout (big drop below target) and adjust the next recommendation | M |
| E11-9 | Weekly plan view: suggest a balanced week (hard/easy days) based on available days | L |
| E11-10 | Procedurally generated workouts at an exact target difficulty (when the library has no good fit) | L |
| E11-11 | Pluggable readiness inputs: engine takes optional external signals (Garmin training load incl. other sports, VO2max trend, training readiness/HRV/sleep) and falls back to our own TSB when they're missing. Design the interface now; wire Garmin in E12-6 | M |

## E12 — Garmin Connect integration (R&D, last)

Runs from the desktop app (scheduled pulls while it's open); moves to the server once E8 exists. Two directions: **upload** our rides to Garmin, and **read** Garmin's metrics into the recommendation engine. Garmin sees everything you do (outdoor rides, runs, sleep), so its load is more complete than our indoor-only CTL/ATL.

| ID | Task | Size |
|---|---|---|
| E12-1 | Research: Garmin Connect Developer Program access for a personal app (Activity API for upload, Health API for metrics) | S |
| E12-2 | Research: intervals.icu API as a bridge, Strava as a bridge, unofficial libs (risks) | S |
| E12-3 | Research: which metrics are reachable per route: VO2max (cycling), acute/chronic training load, load focus, training status, training readiness, HRV status, resting HR, sleep, Body Battery | M |
| E12-4 | Decide on an approach for upload; prototype it | M–L |
| E12-5 | Prototype metrics import: scheduled pull (e.g. every few hours / after sync) into a small `external_metrics` table; must fit the NAS budget | M |
| E12-6 | Feed Garmin metrics into recommendations (see E11-11) | M |

## E14 — Cloud-folder sync (requested 2026-10-21, after E8)

Sync without a server (DESIGN.md §8.6): the user picks a folder that Google Drive, Dropbox, OneDrive or iCloud Drive keeps in sync; the app writes there. No cloud APIs in the app.

| ID | Task | Size |
|---|---|---|
| E14-1 | Journal format: one append-only file per device (rides, profile, FTP history, workouts, routes, favourites, tombstones) + FIT files | M |
| E14-2 | Write own journal; read and apply other devices' journals with the same rules as the server sync (E8) | M |
| E14-3 | Settings: choose the sync folder, status, "Sync now"; handle the folder being unavailable or half-synced | S |
| E14-4 | Test with two machines on Google Drive and Dropbox (partial uploads, conflicted copies) | S |

## E13 — Virtual routes (requested 2026-10-21)

Ride a route with real grades sent to the trainer, exported as a Strava/Garmin "Virtual Ride" (DESIGN.md D16).

| ID | Task | Size |
|---|---|---|
| E13-1 | ✅ done 2026-10-21. Bike weight in the profile (rider weight added with E4, 2026-10-21) | S |
| E13-2 | ✅ done 2026-10-21. (`core/route/`: resampled every 20 m, elevation smoothed over 100 m, optional grade cap; GPX tag scanner like .zwo) Route model in `core`: points (lat, lon, elevation, distance), smoothed grade; GPX import | M |
| E13-3 | ✅ done 2026-10-21. (`core/route/physics.ts`: steady-state solver + momentum integration; no wind yet) Physics in `core`: speed from power, grade, mass, CdA, Crr, wind; unit-tested against known values | M |
| E13-4 | ✅ done 2026-10-21. (`RouteRider` in core; session sends grade × difficulty in free-ride stretches, default 50 %) Route ride: position by distance, send grade via FTMS Indoor Bike Simulation, trainer difficulty % (scales grade like Zwift) | M |
| E13-5 | ✅ done 2026-10-21. (`RouteProfile`, `RouteMap` components) Ride screen for routes: elevation profile with position, grade, distance done/left, route outline (offline, no map tiles) | M |
| E13-6 | 🔧 built 2026-10-21 (records with position/altitude/distance, `virtualActivity`, total ascent; decodes cleanly); **still to do: import a real route ride into Garmin Connect / Strava.** FIT: lat/long/altitude in records, physics speed/distance, sub-sport `virtualActivity`; re-check Garmin/Strava import | S |
| E13-7 | ✅ done 2026-10-21. (SQLite `routes` table, migration 3; 22 built-in routes (classic Alps/Pyrenees/Dolomites/Spain climbs, Mallorca, plus 7 flat ones: Annecy, Champs-Élysées, Afsluitdijk, Belgian coast, Regent's Park, Strandvejen, Alcúdia; added in batches on request 2026-10-21; per-route `router: 'bike'` for park loops) generated by `scripts/build-routes.mjs` from OSM/OSRM + EU-DEM, grade-capped at 12 % against DEM hairpin errors; stats match published figures in a test) Route library in local SQLite (requested 2026-10-21): import a GPX once and it stays; ship a starter set of popular climbs/loops (e.g. Alpe d'Huez, Mont Ventoux, Stelvio, Tourmalet) so nothing needs importing. Built-in routes must come from openly licensed data (e.g. OpenStreetMap geometry + open elevation data, with attribution) | M |
| E13-9 | ✅ done 2026-10-21. (Routes screen: search, distance/climbing/grade filters, favourites) Route browser: filter by distance, elevation gain, average/max grade; favourites | S |
| E13-8 | ✅ done 2026-10-21. (pick a workout on a route card; the route wraps if the workout is longer; free-ride steps follow the grade) ERG workout on a route (move along the route while the workout controls power; grade not applied) | S |

---

## Suggested order

1. **E0 → E6, E7** — MVP: desktop app, ride in ERG mode, FIT export, FTP tests (no server)
1b. **E13** — virtual routes (user request; after the MVP, before the server)
2. **E9 → E3-8 → E10 → E11** — history, workout builder, library, recommendations, all on the desktop
3. **E12** — Garmin integration (upload + metrics import), from the desktop
4. **E8** — server in Docker + sync, last (user decision 2026-10-21): optional backup / multi-device / always-on Garmin (DESIGN.md §8.0)
5. **E14** — cloud-folder sync (Drive/Dropbox/OneDrive/iCloud) for riders without a server
