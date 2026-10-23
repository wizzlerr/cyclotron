# Changelog

## Unreleased

- **Linux**: an AppImage (any distro, updates itself) and a `.deb` for Ubuntu, Debian and Mint
  are now in every release. Bluetooth goes through BlueZ. Not yet tried with a trainer.
- Connecting without Bluetooth (adapter off or missing) now says so instead of doing nothing.
- README: a download link with a "which file do I need" table at the top, and what Cyclotron is
  and isn't (not a Zwift/MyWhoosh replacement; why the 3D world is low-poly).

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
