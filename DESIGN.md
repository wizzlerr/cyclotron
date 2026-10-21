# Cyclotron — Design

Single-player indoor cycling training app for a Wahoo KICKR. Think "Zwift without the 3D world": structured ERG workouts, live training metrics, FTP testing, ride history, and Zwift-style recommended workouts.

Task breakdown lives in [BACKLOG.md](BACKLOG.md). This document explains *how* the system is built and *why*.

---

## 1. Goals and non-goals

**Goals**
- Control a Wahoo KICKR over Bluetooth LE: ERG (target watts), resistance, grade simulation.
- Heart-rate strap support.
- Structured workouts (own format + Zwift `.zwo` import), live metrics, FIT export.
- FTP tests (ramp, 20 min) and FTP history.
- History and analytics: power curve, CTL/ATL/TSB, time in zone.
- **Recommended workouts** ("what should I ride today?"): the main feature Auuki doesn't have.
- Later: Garmin Connect upload and reading Garmin metrics (VO2max, training load) into recommendations.

**Non-goals**
- 3D world, avatars, multiplayer, racing.
- Hosted web version / browser support (Firefox etc.). The app is a desktop app only.
- ANT+ (Bluetooth only).
- Pushing planned workouts to the Garmin calendar.
- Multi-user server. One rider.

---

## 2. Decisions log

| # | Decision | Why | Rejected alternatives |
|---|---|---|---|
| D1 | **Electron desktop app** for Windows + macOS | Ships its own Chromium, so Web Bluetooth works everywhere regardless of the user's browser | Web app (no Firefox/Safari Bluetooth); web app + local Bluetooth bridge for Firefox (extra install, extra code); Tauri (macOS webview has no Web Bluetooth) |
| D2 | **No hosted web version** | Electron makes it unnecessary; removes PWA, browser checks, transport abstraction | — |
| D3 | **TypeScript everywhere, pnpm monorepo** with a shared `packages/core` | Training math, workout model and recommendation engine written once, used by desktop and server | Separate languages for server (Go/Rust) — less RAM, but duplicated math |
| D4 | **Desktop works fully offline; server is optional** | A ride must never depend on the network. Bluetooth can't run in a container on Windows/macOS anyway | Server-driven ride loop |
| D5 | **Server added after the MVP** | Riding sooner; server designed around real ride data | Server from day one |
| D6 | **Server on Synology DS920+ in Docker, < 150 MB RAM** | That's the hardware available (~1 GB RAM free, 2 cores) | — |
| D7 | **SQLite on both sides**. Desktop uses Node's built-in `node:sqlite` (works in Electron 44 / Node 24.22, verified 2026-10-21), so there is no native module to rebuild for Electron; the server may still use `better-sqlite3` | In-process, near-zero idle RAM, one file to back up | Postgres (100 MB+, second container); `better-sqlite3` on the desktop (native rebuild per Electron version) |
| D8 | **Compute once at upload** on the server; per-second data stays in FIT files, not DB rows | Keeps the NAS idle and queries cheap | Storing 1 Hz samples as rows (millions of rows/year) |
| D9 | **Recommendations: rules + scoring, no ML** | Explainable ("why this workout"), fast on the NAS, works with little data | ML model |
| D10 | **Reuse Auuki's math, not its code** (pending license check, E0-6) | Auuki is believed to be AGPL-3.0; formulas aren't copyrightable | Forking Auuki |
| D11 | **Garmin integration last, as R&D** | Official API access is uncertain for a personal app | — |
| D12 | **Svelte 5** for the renderer UI | Small, fast fine-grained updates (live metrics several times per second), little boilerplate | React (safe, heavier) |
| D13 | **uPlot** for charts | Tiny and very fast for live time series | Chart.js, ECharts (heavier) |
| D15 | **Toolchain:** Node 24 LTS, pnpm 12, electron-vite 6 (Vite 8), Electron 44, Vitest 5, ESLint 10 flat config + Prettier. **TypeScript pinned to 6.0** | TS 7 (native Go compiler) isn't supported by typescript-eslint or svelte-check yet; revisit when they support it. Electron 45 was too fresh (pnpm resolved a beta), so we stay on the stable 44 line | TS 7 now; Electron 45 |
| D14 | **Trainer is a Wahoo KICKR CORE 2, controlled over FTMS** | Confirmed in spike E1-0 (2026-10-21, firmware 3.5.11): FTMS features include Power Target, Resistance Target and Indoor Bike Simulation; power range 0–2000 W in 1 W steps; Request Control, Start and Set Target Power all answered `success`. E2-7 (Wahoo proprietary control) dropped. Capture: `packages/core/test/fixtures/` | Wahoo proprietary control |
| D16 | **Virtual routes** (requested 2026-10-21, E13): ride a route (imported GPX or built-in) where the trainer gets the grade via FTMS simulation and speed/distance come from a physics model (power, grade, rider+bike mass, CdA, Crr). Rides on a route are exported with GPS points and sub-sport `virtualActivity` (Strava "Virtual Ride"); rides without a route stay `indoorCycling` | Lets the user mark rides as virtual rides honestly, and adds outdoor-style riding without 3D graphics | 3D world (out of scope: "Zwift without the graphics"); always using `virtualActivity` without a route |
| D18 | **Route data and grade (E13, 2026-10-21):** routes are resampled every 20 m, elevation smoothed over 100 m, grade felt over 100 m around the rider. Trainer gets road grade × difficulty (default 50 %, Settings) via FTMS simulation; speed always uses the real grade (physics: CdA 0.32, Crr 0.004, ρ 1.225, 97 % drivetrain, rider + bike mass, with momentum). Built-in routes: OSM roads routed by OSRM + EU-DEM 25 m elevation (`scripts/build-routes.mjs`), attribution shown on each route; the DEM turns hairpins into fake 20–27 % ramps, so built-ins carry a grade cap (12 %) that moves excess rise to neighbouring stretches, keeping total climbing and summit height | SRTM 30 m (noisier); heavier smoothing (flattens real ramps); hand-drawn profiles without GPS (no virtual ride in Strava) |
| D17 | **Packaging (E7):** electron-builder, NSIS installer on Windows (per-user, choosable folder) and an unsigned `.dmg` on macOS. electron-vite bundles everything into `out/`, so all desktop deps are devDependencies and the package has no `node_modules` (asar ≈ 1.1 MB, nothing native: SQLite is `node:sqlite`). App name is fixed to "Cyclotron", data in `<appData>/Cyclotron` for dev and installed builds alike (pre-E7 `@cyclotron/desktop` folder is moved once). Renderer settings (profile, devices, tiles) are stored in SQLite via a sync `prefs` IPC, because dev (`http://localhost`) and installed (`file://`) builds have different localStorage origins. Single-instance lock | electron-forge (more moving parts for the same result); Squirrel.Windows (no install-folder choice, awkward uninstall); keeping settings in localStorage (lost when switching dev ↔ installed) |

**Open decisions** (to settle at the start of implementation):

| # | Question | Proposal |
|---|---|---|
| O4 | Auuki license | Check in E0-6. |
| O5 | Garmin route | Decided after E12 research. |

---

## 3. System overview

```
┌──────────────────────── Desktop (Electron, Windows/macOS) ─────────────────────────┐
│                                                                                     │
│  Renderer (UI, Svelte)                         Main process (Node)                  │
│  ┌──────────────────────────────┐   IPC via   ┌──────────────────────────────────┐ │
│  │ Screens: Home, Ride,         │   preload   │ SQLite (better-sqlite3)           │ │
│  │ Workouts, History, Settings  │◄──────────► │ FIT writer → user folder          │ │
│  │                              │  (typed     │ Sync queue → server (HTTP)        │ │
│  │ Web Bluetooth ──► KICKR, HR  │   API)      │ Bluetooth device-picker handler   │ │
│  │ Workout player (core)        │             │ powerSaveBlocker                  │ │
│  │ Live metrics (core)          │             └──────────────────────────────────┘ │
│  └──────────────────────────────┘                                                   │
└──────────────────────────────────────────────────────┬──────────────────────────────┘
                                                       │ HTTPS/HTTP on LAN, API token
                                                       │ (only after a ride; optional)
┌──────────────────────── Server (Docker on Synology DS920+) ─────────────┐
│  Fastify API  ─  SQLite (WAL)  ─  /data/fit/*.fit                       │
│  On upload: parse FIT → aggregates (power curve, zones, TSS, daily load)│
│  → recompute CTL/ATL/TSB → progression levels → recommendations         │
│  Later (E12): Garmin upload + scheduled Garmin metrics pull             │
└─────────────────────────────────────────────────────────────────────────┘

packages/core (pure TypeScript, no I/O) is imported by both the renderer and the server.
```

### Repository layout

```
cyclotron/
  package.json, pnpm-workspace.yaml, tsconfig.base.json
  packages/
    core/
      src/
        ble/        FTMS, Cycling Power, Heart Rate parsers + command encoders (bytes in/out only)
        metrics/    rolling averages, NP, IF, TSS, kJ, zones, power curve, CTL/ATL/TSB
        workout/    workout model, validation, .zwo import, player state machine, workout stats
        fit/        FIT encode/decode helpers (wrapping @garmin/fitsdk)
        reco/       readiness, progression levels, recommendation engine
      test/
  apps/
    desktop/
      src/main/      Electron main: window, IPC handlers, SQLite, FIT files, sync
      src/preload/   contextBridge: the only API the UI can call
      src/renderer/  UI, Web Bluetooth device layer, ride session
      resources/     icons, built-in workout library (JSON)
    server/
      src/           Fastify routes, ingestion pipeline, jobs
      Dockerfile, docker-compose.yml
  BACKLOG.md, DESIGN.md, CLAUDE.md
```

**Rule for `core`:** pure functions and state machines only. No Bluetooth, no timers, no DB, no `Date.now()` (time is passed in). That makes all training logic unit-testable and shareable.

---

## 4. Desktop app

### 4.1 Processes

| Process | Responsibility |
|---|---|
| **Renderer** | UI; Web Bluetooth (the API only exists in the renderer); ride session (player + metrics + sample buffer) |
| **Preload** | Exposes a typed `window.cyclotron` API via `contextBridge`. Nothing else from Node leaks to the UI |
| **Main** | SQLite, file system (FIT files), sync to server, Bluetooth device picker (`select-bluetooth-device`), `powerSaveBlocker`, app lifecycle |

Security defaults: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP, no remote content.

Ride-critical setting: the ride window uses `backgroundThrottling: false`, so timers and BLE notifications keep running at full rate when the window is minimized or covered.

### 4.2 Bluetooth device layer

Web Bluetooth in Electron needs our own picker: `navigator.bluetooth.requestDevice()` in the renderer fires `select-bluetooth-device` in the main process with the scan results. Main forwards the list to the UI over IPC; the user picks one; main calls the callback with the device ID. Device IDs are remembered so later sessions can reconnect without the picker where possible.

**Services and characteristics**

| Service | UUID | Characteristics used |
|---|---|---|
| Fitness Machine (FTMS) | `0x1826` | Feature `0x2ACC` (capabilities), Indoor Bike Data `0x2AD2` (notify: speed, cadence, power), Supported Power Range `0x2AD8`, Control Point `0x2AD9` (write + indicate), Status `0x2ADA` (notify) |
| Cycling Power | `0x1818` | Measurement `0x2A63` (notify: power, crank revolutions → cadence). Older Wahoo trainers expose a proprietary control characteristic here (fallback, E2-7) |
| Heart Rate | `0x180D` | Measurement `0x2A37` (notify) |
| Battery / Device Info | `0x180F` / `0x180A` | Battery level, model, firmware (shown in Settings) |

**FTMS Control Point commands** (`0x2AD9`, little-endian):

| Op | Command | Parameters |
|---|---|---|
| `0x00` | Request Control | — (must be first) |
| `0x01` | Reset | — |
| `0x04` | Set Target Resistance Level | uint8/sint16 per spec, 0.1 resolution |
| `0x05` | Set Target Power (ERG) | sint16, watts |
| `0x07` | Start / Resume | — |
| `0x08` | Stop / Pause | uint8 (1 = stop, 2 = pause) |
| `0x11` | Set Indoor Bike Simulation | wind speed sint16 (0.001 m/s), grade sint16 (0.01 %), Crr uint8 (0.0001), Cw uint8 (0.01 kg/m) |
| `0x80` | *Response* (indication) | request op, result (1 = success) |

All control writes go through a **command queue**: one write in flight, wait for the `0x80` response (with timeout), retry once, and coalesce ERG targets (only the latest pending target is sent). Parsing and encoding live in `core/ble` as pure byte functions with unit tests built from captured packets.

**Connection lifecycle:** `disconnected → connecting → connected → (controlling)`. On an unexpected disconnect during a ride: keep the ride clock running, mark samples as "no data", auto-reconnect with backoff, and re-send Request Control + the current target after reconnecting.

**Device interface** (renderer, `src/renderer/src/devices/`): a `Trainer` has `onData`, `onDisconnect`, `setControl(TrainerControl)` and `disconnect()`; `TrainerControl` (in `core`) is `free | erg(watts) | simulation(grade) | resistance(level)`. Protocol details (FTMS Request Control, Start) stay inside the implementation. A separate `HeartRateSource` provides bpm. The UI reads devices only through the `devices` store.

**Simulated trainer** (E1-6): implements the same interface. The model is pure code in `core/sim` (seeded RNG, time passed in): power follows the target with a first-order lag (τ 2 s) and ±3 % noise, HR follows effort with τ 25 s. Used for development, demos and UI tests without hardware.

**FTMS trainer** (E1-2, E2): connects lean (FTMS + Heart Rate services only, sequential GATT calls), subscribes to the Control Point before Indoor Bike Data, then Request Control → Start → last target in the background. All Control Point writes go through a queue in `core` (one in flight, 15 s response timeout, 2 retries, re-request control on "not permitted", and target changes coalesce so ERG bursts send only the latest). "Free ride" is simulation mode at 0 % grade. `BleLink` reconnects dropped links with 1–10 s backoff and re-applies the target. Devices are remembered by **name** (Electron's scan id and Web Bluetooth's `device.id` differ); main auto-picks the remembered name from the scan, but a click is still needed because `requestDevice` requires a user gesture. If no strap is connected directly, the KICKR's own Heart Rate service (relaying a strap paired to it) is used once it sends data.

### 4.3 Ride session (the real-time loop)

```
BLE notifications (≈1–4 Hz) ─► latest values (power, cadence, speed, HR)
                                       │
1 Hz tick (drift-corrected, based on performance.now()) ──┐
                                                          ▼
                      core/workout player.tick(t) ─► target watts ─► command queue ─► KICKR
                      core/metrics.add(sample)    ─► 3s/10s avg, NP, IF, TSS, kJ, zone
                      sample buffer ─► every 5 s batch ─► IPC ─► main ─► SQLite (ride_samples)
                                                          ▼
                                               UI (tiles + uPlot chart)
```

- **Player** is a pure state machine in `core` (`WorkoutPlayer`): `ready → running ⇄ paused → finished`, with `advance(dtS)`, `pause()`, `resume()`, `skip()`, `finish()`, `setIntensity(0.5–1.5)`. `state()` returns the current segment, target watts (FTP × % × intensity), time left in the segment, the next segment and the `TrainerControl` to apply (ERG, simulation for free ride with a grade, otherwise free; free while paused). The renderer's `ride` store ticks it on fixed 1 s boundaries and only sends a control when it changes.
- **Paused time** doesn't count toward workout progress; the sample stream keeps going, but samples are flagged as paused.
- **Sleep/freeze guard:** a gap of more than 5 s between ticks pauses the ride (and the rider resumes) instead of advancing the workout by the gap. Found in testing when a 1 h system sleep jumped a ramp test to its end.
- **FTP tests** (E6): test workouts carry `ftpTest: 'ramp' | '20min'` and mark the measured steps with `effort`; `analyzeFtpTest` uses only those samples. The ramp test jumps to its cooldown when `RampFailureDetector` fires. The summary offers the result; accepting it sets the FTP and logs it in `ftp_history`.
- **Crash recovery:** an unfinished ride row plus its samples are already in SQLite. On startup, the app offers to resume or finish that ride.
- **Sleep prevention:** `powerSaveBlocker.start('prevent-display-sleep')` during a ride.

### 4.4 Local storage (desktop SQLite)

```
profile          (id=1, name, weight_kg, ftp_w, max_hr, resting_hr, goal, weekly_hours, ...)
ftp_history      (id, date, ftp_w, source: manual|ramp|20min|estimate)
devices          (id, kind: trainer|hr, ble_id, name, last_connected_at)
workouts         (id, source: builtin|zwo|custom, name, type, json, duration_s, tss, if, difficulty)
rides            (id, started_at, ended_at, workout_id, status: active|finished|discarded,
                  duration_s, avg_power, np, if, tss, kj, avg_hr, max_hr, ftp_at_ride,
                  feedback, fit_path, synced_at)
ride_samples     (ride_id, t_s, power, cadence, speed, hr, target, flags)   -- desktop only
sync_queue       (id, kind, ref_id, attempts, last_error, next_try_at)
settings         (key, value)                                              -- FIT folder, server URL, token, UI prefs
reco_cache       (id=1, computed_at, json)                                 -- last recommendation from server
```

Per-second rows are fine on the desktop (one rider, plenty of disk). Migrations are numbered SQL strings in `main/db.ts`, tracked with `pragma user_version`.

**Built so far (E5, 2026-10-21):** `rides`, `ride_samples` and `settings` only. Imported workouts are still in `workouts.json`. Since E7 the renderer's small settings (profile: FTP, weight, max HR; remembered devices; ride tiles) are JSON values in `settings` under `pref:<key>` (D17); proper `profile`/`devices` tables come when the server sync (E8) needs them. Main only stores rows and writes files; the renderer computes summaries and encodes FIT with `core` (main externalizes dependencies, so it can't import `core` at runtime). Samples are flushed every 5 s; values older than 3 s (sensor dropped) are recorded as missing, not repeated.

### 4.5 FIT export

On finish: build a FIT activity with `@garmin/fitsdk` (`file_id`, `device_info`, `event`s, 1 Hz `record`s with power/cadence/HR/speed/distance, one `lap` per workout step, `session`, `activity`), sport = cycling, sub-sport = `indoorCycling` (not `virtualActivity`: there is no virtual route or GPS). Pauses are timer stop/start events with no records in between. Save to the user's chosen folder (default `Documents/Cyclotron`) as `YYYY-MM-DD_HHmm_<workout>.fit`. Acceptance test: the file imports cleanly into Garmin Connect and Strava with correct laps and power. The SDK is under Garmin's FIT Protocol License (free to use in apps); it adds ~700 kB to the renderer bundle.

### 4.6 UI screens

| Screen | Content |
|---|---|
| **Home** | Device status, "Today" recommendation card (+2 alternatives, "why"), FTP, fitness/form snapshot, quick start: free ride / workout / FTP test |
| **Ride** | Big tiles (power, target, HR, cadence, interval time left, elapsed), zone color, workout profile with position, live chart, intensity ±, pause/skip/end |
| **Ride summary** | Stats, chart, laps, feedback (Easy…Failed), FIT saved + sync status |
| **Workouts** | Library with filters (type, duration, difficulty), favorites, `.zwo` import, editor |
| **History** | Ride list, ride detail, power curve, CTL/ATL/TSB chart, time in zone per week (from server; local list when offline) |
| **Route ride** (E13) | Ride tiles plus elevation profile with position, grade, distance done/left, and a route outline drawn from the GPS points (no map tiles, works offline) |
| **Settings** | Profile, zones, devices, FIT folder, server URL + token, units, tile layout, about |

---

## 5. Training math (`core/metrics`)

| Metric | Definition |
|---|---|
| Rolling power | Simple moving average over 3 s / 10 s / 30 s |
| **NP** (Normalized Power) | 30 s rolling average → raise each value to the 4th power → mean → 4th root |
| **IF** (Intensity Factor) | NP / FTP |
| **TSS** | (duration_s × NP × IF) / (FTP × 3600) × 100 |
| kJ | Σ power (W) × 1 s / 1000 |
| W/kg | power / weight |
| **Power curve** | Best average power for durations 1 s … 60 min (fixed set: 1, 5, 10, 15, 30 s, 1, 2, 3, 5, 8, 10, 12, 20, 30, 45, 60 min), computed with prefix sums, O(n) per duration |
| **CTL** (fitness) | Exponentially weighted daily TSS, 42-day time constant: `CTL_today = CTL_yday + (TSS_today − CTL_yday) / 42` |
| **ATL** (fatigue) | Same with a 7-day constant |
| **TSB** (form) | `CTL_yday − ATL_yday` |
| FTP from ramp test | 75 % of best 1-minute power (rolling, over the ramp steps only) |
| FTP from 20 min test | 95 % of 20-minute average power (needs ≥ 19 min of the effort) |
| Calories | kcal = kJ of work / 0.24 (gross efficiency) / 4.184 ≈ 1 kcal per kJ. Shown instead of kJ (user preference, 2026-10-21) and written to FIT |
| FTP estimate | From power curve (e.g. 95 % of best 20 min in last 90 days, or a CP model fit); shown as a suggestion only |

**Power zones** (Coggan, % FTP): Z1 Recovery < 55 · Z2 Endurance 56–75 · Z3 Tempo 76–90 · Z4 Threshold 91–105 · Z5 VO2max 106–120 · Z6 Anaerobic 121–150 · Z7 Neuromuscular > 150.
**HR zones**: % of max HR (5 zones: < 60, 60–70, 70–80, 80–90, > 90 %); max HR is set in Settings.

**Live metrics** (E4): `LiveRideMetrics` in `core/metrics/live.ts` updates in O(1) per 1 Hz sample and is tested to equal `summarizeRide` over the same samples, so the numbers during the ride match the saved ride. The 3 s / 10 s power tiles average the trainer's notifications over that time window (`TimeWindowAverage`).

All metric functions are deterministic and covered by unit tests with hand-computed fixtures.

---

## 6. Workouts (`core/workout`)

### 6.1 Format (JSON, stored in `workouts.json`)

```json
{
  "id": "builtin.sweetspot.3x12",
  "name": "Sweet Spot 3×12",
  "type": "sweetspot",
  "description": "Three 12-minute blocks just under threshold.",
  "steps": [
    { "kind": "ramp",   "durationS": 600, "fromPct": 0.45, "toPct": 0.70 },
    { "kind": "repeat", "count": 3, "steps": [
        { "kind": "steady", "durationS": 720, "pct": 0.90, "cadence": 90 },
        { "kind": "steady", "durationS": 300, "pct": 0.55 }
    ]},
    { "kind": "ramp",   "durationS": 300, "fromPct": 0.60, "toPct": 0.40 }
  ]
}
```

Step kinds: `steady`, `ramp`, `repeat` (nested), `freeride` (no ERG, optional grade), `maxeffort` (ERG off, used in tests). Targets are fractions of FTP, so a workout scales to any rider. The model is flattened into a timeline (`buildTimeline`) before playing. Field names are camelCase, matching the TypeScript types in `core/workout/model.ts`. Built-in workouts ship in `core/workout/builtin.ts`; imported ones are stored by main in `<userData>/workouts.json` (`{ version: 1, workouts: [...] }`). Planned IF/TSS come from the 1 s target profile, counting free ride as 50 % and max effort as 150 % FTP.

Derived per workout (computed, stored with it): duration, TSS, IF, time in each zone, **primary type**, **difficulty level 1–10** (see 7.3).

### 6.2 Zwift `.zwo` import

`.zwo` is XML: `<Warmup>`, `<Cooldown>`, `<Ramp>`, `<SteadyState>`, `<IntervalsT>` (repeat on/off), `<FreeRide>`, `<MaxEffort>`, with `Duration` in seconds and `Power*` as FTP fractions. These map 1:1 onto the JSON step kinds. Text events and unknown elements are ignored. Parsed with a small tag scanner (no DOM in `core`). Cooldowns always ramp down, whichever way round `PowerLow`/`PowerHigh` are written, as Zwift does.

---

## 7. Recommendation engine (`core/reco`) ⭐

Goal: open the app and see **one recommended workout for today, two alternatives (easier / shorter), and a one-line reason**, like Zwift/TrainerRoad. Rule-based and explainable; runs in milliseconds.

### 7.1 Inputs

| Input | Source |
|---|---|
| Profile: FTP, goal, weekly time available, preferred ride days | profile |
| Daily load: CTL, ATL, TSB (last 90 days) | server aggregates |
| Recent rides: type, TSS, IF, feedback, completed/failed (last 14 days) | server |
| Zone distribution last 7 / 28 days | server aggregates |
| **Progression levels** per workout type | server (`progression_levels`) |
| Workout library with metadata | built-in + custom |
| Optional external signals (Garmin: acute/chronic load incl. other sports, VO2max trend, training readiness, HRV, sleep) | E12, via a pluggable `ReadinessSignal` interface; missing = ignored |

### 7.2 Pipeline

1. **Readiness** → `fresh | normal | fatigued | very_fatigued`
   - Base: TSB bands (e.g. > +5 fresh, −10…+5 normal, −25…−10 fatigued, < −25 very fatigued).
   - Adjust: hard workout yesterday (IF > 0.85) → at most `normal`; two hard days in a row → at least `fatigued`; failed workout in last 2 days → one step more tired.
   - If external signals are present, combine them (e.g. Garmin readiness low → one step more tired). The output stays the same 4 states.
2. **Pick the workout type for today**
   - Score each type (recovery, endurance, tempo, sweetspot, threshold, vo2max, anaerobic):
     - **Goal weight**: e.g. "raise FTP" favors sweetspot/threshold; "endurance" favors endurance/tempo; "VO2" favors vo2max.
     - **Readiness gate**: very fatigued → only recovery/rest; fatigued → recovery/endurance; fresh → hard types get a bonus.
     - **Balance**: keep roughly 80 % low-intensity / 20 % high-intensity time over 7–28 days; types that would push past the target get a penalty.
     - **Recency**: penalty if the same hard type was done in the last 2–3 days; bonus if it hasn't been done in 10+ days.
     - **Rest**: if weekly TSS is already at target or it isn't a ride day, recommend rest or recovery.
   - Highest score wins; runner-up types feed the alternatives.
3. **Pick the concrete workout**
   - Filter the library by type and by duration ≤ time available today.
   - Target difficulty = current progression level for that type + small stretch (+0.3…+1.0 when fresh, 0 when normal, −1 when fatigued).
   - Choose the workout with difficulty closest to target; prefer ones not done in the last 14 days. If nothing fits within ±1 level, generate one (E11-10).
4. **Alternatives**: one easier (lower difficulty or lower-intensity type), one shorter (same type, shorter duration).
5. **Explanation**: built from the rules that fired, e.g. *"You're fresh (form +8) and haven't done threshold work in 9 days. Threshold level 4.2 → this is a 4.6."*

### 7.3 Difficulty and progression levels

- **Workout difficulty (1–10)** per type, computed from the workout itself: time in the target zone, interval length, recovery ratio, and intensity relative to the type's zone. Calibrated so that "longer intervals / shorter rests / higher % FTP" = higher level.
- **Progression level (1–10)** per type, per rider, stored on the server:
  - Completed workout of that type: level moves toward the workout's difficulty, scaled by feedback (Easy +more, Moderate +normal, Hard +small, Very hard 0, Failed −small).
  - Failed = auto-detected (ERG target not held: e.g. > 15 % below target for > 20 % of the work intervals) or reported by the rider.
  - Levels slowly decay if a type isn't trained for several weeks.
  - An FTP change rescales levels (new FTP → old workouts become easier).

### 7.4 Where it runs

The engine is pure code in `core`. The server runs it after every ride ingestion and on a daily schedule (new day = new TSB), and stores the result. The desktop fetches it on sync and caches it in `reco_cache`, so the Home card works offline. Without a server, the desktop can run the same engine on local data (reduced version: TSB from local rides).

### 7.5 Weekly plan (later, E11-9)

Given ride days and weekly hours: place 2–3 hard days with easy/rest days between, fill the rest with endurance, cap weekly TSS ramp at ~+5–8 CTL/week. Today's recommendation then comes from the plan, adjusted by readiness.

---

## 8. Server

### 8.1 Runtime and budget

- Node 24 LTS + Fastify, `better-sqlite3` (WAL), single process, single container.
- Docker image: multi-stage, `node:24-alpine`, production deps only. DS920+ is x86-64, so no ARM builds.
- Limits: `mem_limit: 256m`, `NODE_OPTIONS=--max-old-space-size=128`. **Target < 150 MB RSS, ~0 % CPU idle.**
- Volume: `/data` → `cyclotron.db` + `fit/` folder. Backed up by Synology Hyper Backup; nightly `VACUUM INTO` snapshot for a consistent copy.
- Runs on the LAN; reachable from the desktop by IP/hostname. If exposed outside the LAN, it goes behind Synology's reverse proxy with HTTPS.

### 8.2 Data model (server SQLite)

```
profile, ftp_history                          -- source of truth, synced to desktop
rides                (id, client_ride_id UNIQUE, started_at, duration_s, workout_id, workout_type,
                      avg_power, np, if, tss, kj, avg_hr, max_hr, ftp_at_ride, feedback, failed, fit_path)
ride_power_curve     (ride_id, duration_s, watts)        -- ~16 rows per ride
ride_zone_time       (ride_id, zone, seconds)            -- 7 rows per ride
daily_load           (date, tss, ctl, atl, tsb)          -- 1 row per day
progression_levels   (type, level, updated_at)
recommendations      (date, json, computed_at)
external_metrics     (date, source, metric, value)       -- E12 (Garmin)
```

### 8.3 Ingestion pipeline (on ride upload)

1. Store the FIT file in `/data/fit/` (idempotent on `client_ride_id`).
2. Parse it once (streaming, no full in-memory copies beyond the samples array of one ride).
3. Compute summary, power curve, zone times → insert rows.
4. Update `daily_load` from the ride date forward (incremental, cheap).
5. Update progression level for the workout type.
6. Recompute today's recommendation.

Everything happens in one transaction. Target: a 2-hour ride processed in < 1 s on the NAS (measured in E8-7).

### 8.4 API (JSON, `Authorization: Bearer <token>`)

```
GET  /api/health
GET  /api/profile                 PUT /api/profile
GET  /api/ftp-history             POST /api/ftp-history
POST /api/rides                   (multipart: FIT file + summary JSON incl. client_ride_id, feedback)
GET  /api/rides?cursor=&limit=    GET /api/rides/:id   GET /api/rides/:id/fit
GET  /api/analytics/power-curve?days=42|90|all
GET  /api/analytics/load?from=&to=
GET  /api/analytics/zones?weeks=
GET  /api/recommendation/today
POST /api/import/fit              (bulk import of past rides, E9-5)
```

Responses gzip-compressed; lists paginated.

### 8.5 Sync model

- Rides are **append-only** and created on the desktop → uploaded through `sync_queue` with retry/backoff. `client_ride_id` makes uploads idempotent.
- Profile and FTP history: server is the source of truth; desktop keeps a cache and sends changes with a `updated_at` (last write wins; one user, so conflicts are rare).
- Recommendation and analytics: pulled after each successful upload and on app start.
- No server configured → everything still works locally (FIT export, local history list, local reduced recommendation).

---

## 9. Garmin integration (E12, R&D)

Two directions, both on the server:

1. **Upload** finished rides to Garmin Connect.
2. **Read** Garmin metrics (VO2max cycling, acute/chronic training load, load focus, training status, training readiness, HRV, resting HR, sleep, Body Battery) into `external_metrics`, then into the recommendation engine through the `ReadinessSignal` interface.

Routes to research: official Garmin Connect Developer Program (Activity API / Health API; access needs approval), intervals.icu as a bridge (simple API key), Strava as an upload bridge, unofficial libraries (work with your login; fragile and against the spirit of Garmin's terms). Current expectation (unverified): official Health API covers dailies/sleep/HRV and maybe VO2max, but not training load/status/readiness; unofficial libraries cover nearly everything.

The scheduled pull runs every few hours and must fit the NAS budget (short-lived, small responses).

---

## 10. Testing strategy

| Layer | How |
|---|---|
| `core/ble` | Unit tests on byte arrays (captured real packets from the KICKR + spec examples) |
| `core/metrics` | Fixtures with hand-computed NP/TSS/power curve/CTL values |
| `core/workout` | Flattening, player state machine with injected time, `.zwo` import of real Zwift files |
| `core/reco` | Scenario tests: "fresh rider with FTP goal and 60 min" → expected type/workout and explanation |
| Desktop | Simulated trainer for end-to-end ride runs; Playwright for Electron for key flows (later) |
| FIT | Round-trip: encode → decode with fitsdk → compare; manual import check into Garmin Connect/Strava |
| Server | Route tests with an in-memory SQLite; performance check on the NAS (E8-7) |

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Slow BLE on Windows: in E1-0, connect + discovery + subscribing to all 13 characteristics took ~70 s; one ERG response took ~10 s and notifications arrived in bursts | Connect lean (FTMS + HR only); command queue coalesces ERG targets and never blocks the ride loop; re-measure with the spike's Lean mode (logs per-command latency). Likely cause: the PC was ~8 m and two walls from the trainer; keep the PC near the bike or use a USB BLE dongle on an extension cable close to the trainer |
| Web Bluetooth quirks in Electron (picker, Windows pairing, reconnect) | Spike early (E1-0/E1-1) before building UI on top |
| Timers throttled when window is in the background | `backgroundThrottling: false`; drift-corrected tick from `performance.now()` |
| AGPL contamination from Auuki | E0-6: reimplement from formulas/specs, don't copy code |
| Garmin API access denied | Manual FIT import always works; intervals.icu bridge; unofficial lib as last resort |
| NAS RAM | Budget + measurement task (E8-7); SQLite, single process, compute-once |
| macOS distribution | Unsigned is fine for personal use; signing ($99/yr) only if shared |
