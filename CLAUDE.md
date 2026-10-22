# Cyclotron

Single-player indoor cycling training desktop app for a Wahoo KICKR ("Zwift without the graphics"): ERG workouts, live metrics, FTP tests, history, and Zwift-style **recommended workouts** (the key feature).

- **[DESIGN.md](DESIGN.md)**: architecture, decisions log (with rejected alternatives), data model, BLE protocols, training math, recommendation engine, server, Garmin plan.
- **[BACKLOG.md](BACKLOG.md)**: epics E0–E12 with task IDs and sizes, suggested order.

Read both before starting work. Refer to tasks by ID (e.g. "E1-0").

## Current status (2026-10-21)

- **E0-1 and E0-2 done** (2026-10-21): pnpm monorepo (`packages/core`, `apps/desktop`), Electron + electron-vite + Svelte 5 scaffold with secure defaults and a typed preload API (`window.cyclotron`, types in `apps/desktop/src/shared/api.ts`). `pnpm dev | test | typecheck | lint | format:check | build` all pass. Toolchain notes in DESIGN.md D15.
- Git remote is `https://github.com/wizzlerr/cyclotron`. **The user handles all git commits/pushes; never commit.**
- **E1-0 done** (2026-10-21): KICKR CORE 2 (fw 3.5.11) accepts FTMS control (Request Control, Start, ERG all `success`), so E2-7 is dropped. Capture saved as a test fixture in `packages/core/test/fixtures/`. **Concern:** on Windows, the full connect took ~70 s and one ERG response ~10 s. The spike now has a "Lean" mode (FTMS + HR only, logs per-command latency) to re-measure. The KICKR also bridges a Polar H10 (seen in Wahoo proprietary data), so HR may come via the trainer's own HR service.
- **E0-3 and E1-6 done** (2026-10-21): app shell with sidebar (Home, Ride, Workouts, History, Settings; spike reachable from Settings → Developer), `Trainer`/`HeartRateSource` interfaces + `devices` store in `apps/desktop/src/renderer/src/devices/`, simulated trainer (model in `packages/core/src/sim/`). Ride screen has basic tiles and ERG ±10 W.
- E1-0 latency was probably distance (PC ~8 m and two walls from the trainer). Optional re-test in Lean mode with the PC/dongle near the bike, pedalling properly.
- **E1-1, E1-2, E1-4, E1-5, E2-1, E2-2, E2-5 built** (2026-10-21), **tested on the real KICKR** (ERG 150/200 W held steady, HR and reconnect work): `FtmsTrainer` and `BleHeartRate` (in `devices/`), `BleLink` (connect timeout 45 s, auto-reconnect with backoff, re-applies the last target), command queue + `controlCommand` in `packages/core/src/ble/ftms-queue.ts`. Free ride = simulation at 0 %. Devices remembered by name (main auto-picks it from the scan). The KICKR's relayed HR is used when no strap is connected.
- **E3-1…E3-7 done** (2026-10-21): workout model, timeline, stats, player, `.zwo` parser and built-ins in `packages/core/src/workout/`; Workouts screen (library, import, SVG profile), workout Ride screen (tiles, profile, pause/skip/end, intensity ±1/±5 %, beeps), FTP in Settings (localStorage until E5), `powerSaveBlocker` during rides. Driven end to end on the simulated trainer.
- **E5 done** (2026-10-21; a real KICKR ride imported cleanly into Garmin Connect): rides recorded to SQLite (`node:sqlite`, `apps/desktop/src/main/db.ts`, `rides.ts`), FIT encode with `@garmin/fitsdk` in `packages/core/src/fit/`, summary/laps in `core/ride/`, summary screen, local History list, crash recovery card on Home, FIT folder in Settings. "Start free ride" records a free ride (a workout with one 6 h free-ride step; manual ERG allowed in free-ride steps). Verified end to end on the simulated trainer; the app's FIT files decode cleanly.
- **E4 done** (2026-10-21): 3 s/10 s power, power + HR zones on tiles, live avg/NP/IF/TSS/kJ/W/kg (`core/metrics/live.ts`), uPlot live chart (`components/LiveChart.svelte`), tile choice in Settings → Ride screen. Profile now has weight and max HR (localStorage).
- **Virtual routes requested** (2026-10-21): new epic E13 + decision D16 (GPX routes, physics speed, FTMS grade, FIT `virtualActivity` with GPS). Planned after the MVP.
- **E6 done** (2026-10-21): ramp + 20-min FTP tests (`core/workout/ftp-tests.ts`), result card with "Use X W" in the ride summary, FTP history (SQLite `ftp_history`, listed in Settings). Simulated rider now caps at 325 W so ramp tests fail realistically. Rides auto-pause after a > 5 s tick gap (sleep/freeze). Calories (kcal) replace kJ everywhere in the UI.
- **E7 mostly done** (2026-10-21): `pnpm dist` (in `apps/desktop`) builds `dist/Cyclotron-Setup-0.1.0.exe` (NSIS, unsigned); the packaged app was driven end to end. App data now in `%APPDATA%\Cyclotron` (old `@cyclotron\desktop` folder moved on first start); profile/devices/tiles moved from localStorage to SQLite (D17). Open: build/try the `.dmg` on a Mac (E7-1/E7-2), real-KICKR Bluetooth in the installed app; E7-4/E7-5 optional.
- **UX + open-source prep** (2026-10-21): workout profile has hover tooltips (step, watts, duration) and power/time axes on the Ride screen; live chart has axis titles and whole-second ticks. README.md (with screenshots in `docs/images/`) and LICENSE (AGPL-3.0-or-later). `.idea/` and `caputre/` untracked and gitignored.
- **E13 done except the import check** (2026-10-21): routes in `core/route/` (GPX, route model, physics, `RouteRider`, built-in data), Routes screen, route panel on the Ride screen, workouts on routes, FIT `virtualActivity` with GPS. Decision D18. Built-in data regenerates with `node scripts/build-routes.mjs` (needs network). **Open:** E13-6 — import a real route ride into Garmin Connect/Strava.
- **Responsive UI + 22 routes** (2026-10-21): Workouts/Routes grids and Home/Settings cards (`.cards` in app.css) use the full window; ride tiles and charts scale with window size; Settings → Display → Interface size (webFrame zoom, 80–200 %). Checked at 1080p, 4K @100/150 % and MacBook Retina sizes via CDP emulation. 5 flat routes added (Afsluitdijk, Belgian coast, Regent's Park via bike router, Strandvejen, Alcúdia).
- **Order changed (2026-10-21, user):** server (E8) moves to the end; E9 → E10 → E11 → E12 run on the desktop first (D19). `core/metrics/curve.ts` and `load.ts` were written at the start of E8 and are kept for E9.
- **E9 done** (2026-10-21): ride detail (History), Progress screen (fitness/fatigue/form, power curve, weekly zones, FTP estimate), FIT import; aggregates in desktop SQLite (migration 4, `main/analytics.ts`), `core/fit/decode.ts`. Server role + online/offline model + cloud-folder sync epic E14 written into DESIGN §8 (D20). Charts follow the dataviz rules (one y-axis per chart, validated `--series-1..3` colours).
- **E3-8 workout builder done** (2026-10-21): `screens/Builder.svelte`, `components/StepRow.svelte`, `workouts/builder.svelte.ts`, `core/workout/builder.ts` (validation, `parseDuration`, `workoutToZwo`). Driven end to end.
- **E10 done** (2026-10-22): 47 built-in workouts (`core/workout/builtin.ts`), `workoutMeta` (type classification, difficulty 1–10, zone times) in `core/workout/meta.ts`, Workouts screen with search/type/length/level filters, sort, favourites and "done before" markers. Player Test moved to Settings → Developer. Driven in the dev app; the "done" marker wasn't seen live (the dev DB has only a free ride).
- **Route picker / workout picker** (2026-10-22): Ride on a workout card opens a visual route picker, Ride on a route card a visual workout picker (both on `components/PickerDialog.svelte`); FTP tests skip the route picker.
- **E15 Polish done** (2026-10-22, D21): in-house i18n in `renderer/src/i18n/` (`t()`, one messages file per area with `pl: typeof en`, `content.ts` for built-in workout/route text, `errors.ts`), language select in Settings (first start follows the system), live switching. Core is language-free: `validateWorkout` returns `WorkoutProblem` codes, parser errors carry `code`, `WORKOUT_TYPE_NAMES` removed. Main words its dialogs (`main/i18n.ts`). BLE spike stays English. Driven in Polish on the simulated trainer.
- **E11 done** (2026-10-22): engine in `core/reco/` (readiness, levels replayed from history, type + workout choice, failed-ride detection, `ReadinessSignal` for Garmin), Today card on Home (`components/TodayCard.svelte`, `reco/today.svelte.ts`), Settings → Training (goal, hours/week, training days), levels on Progress, `target_hit` per ride (migration 5). Driven in the dev app (Polish). E11-10 generated workouts (`core/workout/generate.ts`) and E11-9 weekly plan (`core/reco/plan.ts`, "This week" card on Home) done: **E11 complete**.
- **Order (2026-10-22, user):** finish E11 (E11-10, E11-9) → E12 (Garmin) → E16 (optional virtual world view, D22 proposed). E8 (server) and E14 (folder sync) are on demand only: built when users ask.
- **E12 started** (2026-10-22): research done (DESIGN §9, D23): Garmin **Personal API** (rider's own key, read-only, launched 2026-10-21) for metrics; upload is semi-manual ("Send to Garmin" opens Garmin's import page + the FIT file) because no official upload exists for us; Strava/intervals.icu don't forward to Garmin (Strava upload = optional E12-7). Built: `main/garmin.ts` (key encrypted with `safeStorage`, token exchange, `garminGet`, "Save sample data" dumps a week of every endpoint to `<userData>/garmin-sample-<date>.json`), Garmin card in Settings, "Send to Garmin" in ride summary/detail. A fake key gets 401 from Garmin as expected.
- Next step: **the user creates a Personal API key**, connects it in Settings → Garmin Connect and saves sample data; read that JSON to design E12-5 (stored metrics, scheduled pull) and E12-6 (signals: HRV/sleep/Body Battery, other sports' load). Then E16.
- **Resume here (saved 2026-10-22):** E11 is uncommitted on top of the E10/E15 commit; tests, typecheck, lint, format pass. Open checks for the user, none blocking: a real KICKR ride in grade (route) mode; E13-6 (route ride shows as a virtual ride in Garmin/Strava); rebuild the installer with `pnpm dist`; the macOS `.dmg` is untested.
- Shell note: pnpm lives in `%APPDATA%\npm`; the Bash tool's PATH doesn't include Node, so run pnpm through PowerShell after refreshing `$env:Path` from the Machine+User values.

## Open questions to raise with the user

1. **Auuki license** (E0-6): believed AGPL-3.0, unverified. Cyclotron is now AGPL-3.0-or-later (chosen 2026-10-21), so copying Auuki code would be license-compatible once verified; until then reuse formulas only and credit the source.

Resolved 2026-10-21: trainer is a **KICKR CORE 2** (D14, FTMS expected); UI is **Svelte 5 + uPlot** (D12, D13); GitHub remote exists.

## Key decisions (summary; details and reasons in DESIGN.md §2)

- Electron desktop app for Windows + macOS. **No hosted web version**, no Firefox/bridge, no Tauri.
- TypeScript everywhere, pnpm monorepo: `packages/core` (pure logic, no I/O, no `Date.now()`), `apps/desktop`, `apps/server`.
- Desktop works fully offline; Bluetooth, workout player and recording never depend on the server.
- Server comes **last** (after E9–E12, which run on the desktop; D19).
- Server runs in Docker on the user's **Synology DS920+** with ~1 GB RAM free: **performance is a hard requirement**. Budget < 150 MB RAM, ~0% CPU idle. SQLite (not Postgres), single container, compute-once at upload, per-second data stays in FIT files.
- Recommendations: rules + scoring, explainable, no ML. External signals (Garmin) are optional inputs through a pluggable interface.
- Garmin Connect is the **last epic and R&D**: upload rides + read metrics (VO2max, training load, readiness). **No** pushing planned workouts to Garmin.

## About the user / environment

- Develops on Windows 10 (PowerShell + Git Bash available). Project root: `D:\Projects\cyclotron`.
- Rides a Wahoo KICKR CORE 2, has a heart-rate strap, uses Garmin Connect, owns a Synology DS920+.
- Prefers concise answers and making decisions quickly; push back with a recommendation when an idea has a real cost (e.g. the Firefox bridge was dropped once its cost was clear).

## Conventions

- Keep `packages/core` pure and unit-tested (Vitest). Time is passed in, never read.
- UI text is bilingual (English + Polish, D21): never hard-code user-visible strings; add them to the area's `renderer/src/i18n/messages/*.ts` in both `en` and `pl`, use `formatNumber`/`formatDate` for numbers and dates. `core` returns codes, not sentences.
- Electron security defaults: `contextIsolation`, `sandbox`, no `nodeIntegration`; the UI only talks to main via the typed preload API.
- Update BACKLOG.md when scope changes, and DESIGN.md §2 when a decision is made or reversed. Update "Current status" above at the end of each session.
