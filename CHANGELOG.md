# Changelog

## Unreleased

**Changed**

- Ride buttons moved to the side bar: big and always in the same place. Start / Resume are
  green, Skip yellow, End red. Intensity, World and Mute are there too, and they stay while you
  look at another screen mid-ride.
- Pick what each Zwift controller button does on the Ride screen (Settings → Devices →
  Controllers): start/pause, skip, end (press twice), + / −, ERG, mute, world or nothing.
- Combined ride tiles: power / target, average power | NP, and one time tile with the interval
  time left (blue), elapsed and total. Your tile choice is moved over automatically.
- Louder beeps.

**Fixed**

- Zwift Click v2: the − button raised the power instead of lowering it. Controller buttons now
  follow Zwift: the left side is −, the right side +.
- Controller + / − in a workout now moves the target by exactly 1 W per press (it was 1 %, so
  1 or 2 W depending on rounding).

## 0.5.0 (2026-11-02)

**New**

- **Pick the workout type on the Today card**: Auto (the app decides) or any type, e.g. what your
  running watch suggests when you ride instead of a run. Your form still sets how hard it is.
  Time can now be any number of minutes (say 23 or 51), and easy rides fill that time exactly.
- **Variants of the recommended workout**: up to five ways to ride the same thing (e.g. 3×6 min,
  2×8 min, 1×12 min at threshold), about equally hard, as buttons on the Today card. Workouts
  made for you also rotate: intervals you rode in the last two weeks give way to a different set.
- **intervals.icu**: connect with your API key (Settings → Connections). Send rides to intervals.icu
  by hand or automatically, and ride the workouts planned on your intervals.icu calendar from the
  new "Planned on intervals.icu" card on Home. Rides of a planned workout are matched to it.
  A workout planned for today becomes the Today recommendation (with easier and shorter options),
  resting heart rate, HRV and sleep from intervals.icu count toward readiness, and the card shows
  when the FTP differs between the two, with a button to copy it either way.
- **Settings in tabs**: Devices, Profile, Ride, Connections and App, instead of one long page.
  Links such as "Devices" on the Ride screen open the right tab.
- **Your data** (Settings → Profile): export everything to one backup file, import it (on this or
  another computer), or delete all data. Service keys aren't in the backup; FIT files are never
  deleted.

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
