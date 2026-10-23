# Changelog

## Unreleased

## 0.4.0 (2026-10-23)

Cyclotron now runs on Linux too: Windows, macOS and Linux installers are on the release page.

**New**

- **Linux** (x64): an AppImage for any distro, which updates itself on restart, and a `.deb` for
  Ubuntu, Debian and Mint. Bluetooth goes through BlueZ.

**Fixed**

- Connecting a device with Bluetooth turned off (or no adapter) now says Bluetooth isn't
  available, instead of silently doing nothing.

**Docs**

- The README has a download link at the top with a table of which file to pick, and explains
  what Cyclotron is and isn't: a training app, not a Zwift or MyWhoosh replacement.

**Known limits**

- Linux and macOS builds haven't been tried with a trainer yet; reports are welcome.
- On Ubuntu 24.04 and later the AppImage may not start (AppArmor): use the `.deb`.
- The installers aren't code-signed: Windows SmartScreen warns, choose More info → Run anyway.

## 0.3.0 (2026-10-23)

The first installer on the Releases page. Windows 10/11, tested on a Wahoo KICKR CORE 2. The
macOS build is included but untested.

**Training**

- Structured ERG workouts: 47 built-in workouts with levels 1–10, a workout builder and Zwift
  `.zwo` import.
- A recommended workout for today, from your fitness, fatigue and form, recent rides and how
  hard workouts felt, with an explanation, plus an easier and a shorter option.
- A weekly plan over your training days, with planned vs done load.
- FTP ramp test and 20-minute test, with FTP history.

**Riding**

- Trainer control over Bluetooth FTMS: ERG, resistance mode, free ride, grade on routes;
  automatic reconnect. Trainers with only a Cycling Power service connect read-only.
- Heart rate from a BLE strap or relayed by the trainer.
- 22 built-in routes (Alpe d'Huez, Mont Ventoux, Stelvio, flat loops…) and GPX import; rides
  are saved as virtual rides with GPS.
- An optional low-poly 3D view of the route.
- Zwift Play and Click controllers: drive the whole app from the handlebars.
- Live metrics (power, NP, IF, TSS, zones, calories), a live chart and countdown beeps.
- Start a route anywhere and ride it in reverse: pick the direction and the start kilometre (or
  click the profile or the route map) before riding. The map shows where you start and which way
  you go. A loop started part-way goes all the way round.

**After the ride**

- Every ride saved locally and as a FIT file; crashed or interrupted rides can be continued.
- History, ride details and a Progress screen (fitness/fatigue/form, power curve, zones).
- Garmin Connect (your own Personal API key): other activities and wellness feed the
  recommendations; "Send to Garmin" uploads a ride.
- Strava upload with your own API app, by hand or automatically.

**App**

- English and Polish.
- Automatic updates on Windows (Settings → About).
- Diagnostic report for bug reports (Settings → Problem?).

**Known limits**

- The installer isn't code-signed: Windows SmartScreen warns, choose More info → Run anyway.
- Only the KICKR CORE 2 has been tested; reports from other FTMS trainers are welcome.
- macOS build not tested
