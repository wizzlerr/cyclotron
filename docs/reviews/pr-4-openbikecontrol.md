## Review: Add OpenBikeControl support

Thanks for this. It's a clean contribution and I'd like to merge it. The protocol code is pure and well tested, it matches PROTOCOL.md and BLE.md (UUIDs, button-state frames, button ids, the App Information layout), and mapping onto the existing `ZwiftButton`s means navigation, the button-action table and the tester keep working unchanged. Merged onto `development`, `pnpm test`, `typecheck` and `lint` all pass.

The main rule behind most of the points below: **nothing that works for existing riders may change, and when a new code path can't decide, the old behaviour is the fallback.**

Status: **changes requested.** Items 1–2 block the merge, 3–5 should be fixed in this PR, the rest are small.

---

### 1. Detect the controller kind from its GATT services, not from advertisements (blocking)

**Where:** `devices.svelte.ts`, `detectControllerKind` and its call in `connectController`; `main/bluetooth.ts`.

**What happens now:** every newly added controller, including the Zwift Click / Play / Ride that work today, must send a recognised advertisement within 3 s after the pick, or the add fails with `unknownKind`.

**Why it's a problem:**
- On Windows, advertisements are easy to miss. My own setup is a Click v2 with the PC about 8 m and two walls from the bike, and connects there already take a long time.
- The 3 s timer starts before `watchAdvertisements()` has resolved. On Windows, starting the discovery session can use up most of that time.
- Manufacturer data (Zwift's 0x094A) may only come in the scan response.
- The two failure paths behave differently: a rejected `watchAdvertisements()` falls back to Zwift, but a timeout throws. So the outcome depends on *how* detection fails.
- It needs `WebBluetoothWatchAdvertisements` and `WebBluetoothScanning`, which `enableWebBluetooth` now turns on for **every** user on Windows and macOS, not only Linux. These are experimental Blink features. They could change how the picker or scanning behaves for the trainer and heart rate strap, and checking that the API exists doesn't show that nothing else changed.

**What to do:** connect once and pick the controller class from the services the device actually has:

1. Connect GATT (both `OBC_SERVICE` and the Zwift services are already in `optionalServices`).
2. If `server.getPrimaryService(OBC_SERVICE)` succeeds → OpenBikeControl; otherwise → Zwift, which is today's behaviour.
3. Build the controller on that same connection, for example a small `detect(server)` step before choosing the class, or letting one `BleLink` setup pick the handler.

This is a single connection, not the "second, slow connect" that D34 rejects. It works without any Blink feature, so please also remove:
- `watchAdvertisements` and `detectControllerKind`
- `optionalManufacturerData` and the extra `pick` / `connect` parameter
- the two features in `enableWebBluetooth`, so Windows and macOS stay as before and Linux keeps only `WebBluetooth`
- the `unknownKind` strings, and update D34 to match.

A device that has both services (a bridge app) should be OpenBikeControl, as now.

If you really want to keep advertisements, the minimum is: start the timer only after `watchAdvertisements()` resolves, and on timeout fall back to Zwift with a log line instead of throwing. I'd still prefer the GATT approach.

### 2. Picking a controller that is already connected or remembered fails (blocking)

**Where:** `connectController`, the `known && sameController(known, picked)` check.

**What happens:** with a Zwift controller connected, "Add controller…" → pick the same unit. `known` is undefined, so detection runs. A connected peripheral usually stops advertising, so it times out with `unknownKind`. Before this PR, that path reconnected and replaced the unit (see the "Reconnecting the same unit replaces it" comment). The same applies to a remembered controller chosen through the picker instead of its "Connect" button: its stored `kind` is ignored.

**What to do:** fixing item 1 solves this, because GATT detection works on a connected device. If you keep advertisements, look up the kind in `this.controllers` and `this.rememberedControllers` with `sameController(…, picked)` before detecting.

### 3. Remember bridged controllers by name (should fix)

**Where:** `connectController` (remembered entries) and `sameController`.

**What happens:** BikeControl on a phone advertises with a rotating random address. The remembered address never matches again, so:
- `preferDevice(address)` doesn't auto-pick it,
- the stored kind isn't reused,
- a new entry is saved every session, so the Controllers card grows one more "Connect …" button each time.

**What to do:** for `kind === 'obc'`, match and remember by name, or replace an entry with the same name when the address changed. A Zwift Play still needs the address, because its two halves share one name.

### 4. A lost release message leaves a button dead (should fix)

**Where:** `ObcButtonTracker.update` in `core/ble/openbikecontrol.ts`.

**What happens:** a press only counts on a 0 → non-zero change for an id. Notifications aren't guaranteed. If the release frame is lost, that id stays "held" and every later press of that button is ignored until the controller reconnects. Mid-ride, that's the + or − button gone.

**What to do:** treat a frame that reports an already-held id as pressed again as a new press (a device only sends changes, so a repeated "pressed" means a release was missed). Add tests for it.

### 5. App Information doesn't fit one default-MTU write (should fix)

**Where:** `ObcController.setup` and `obcAppInfo`.

**What happens:** "cyclotron" + the version + 10 ids is about 29 bytes. BLE.md asks to fit the 20-byte payload of the default MTU, or truncate gracefully. On a peripheral without Long Write the write fails, and `.catch(() => undefined)` hides it. A peripheral that never answers stalls `setup()` until the ATT timeout (~30 s), which delays the connect.

**What to do:** keep the message within 20 bytes (for example leave out 0x30/0x31, which you map onto the same buttons as 0x01/0x02 anyway, or send an empty version). Put the write behind a short timeout, and log a failure with `logEvent` instead of swallowing it.

### 6. Smaller points

- **Highlight on the Ride screen:** with a pad highlight active on the Ride screen, a bridged press `[0x01, 0x30, 0x14]` resolves to shift up and runs "+" instead of pressing the highlighted button. Use `'menus'` when padnav has a highlight.
- **Coupling:** `devices.svelte.ts` now imports `nav` to compute the context. Please pass the context in from the caller (or from padnav) instead of having the device store read navigation state.
- **Log noise:** `stop.abort()` in `finally` makes the `.catch` log "watchAdvertisements failed" on normal runs. This goes away with item 1; otherwise ignore errors once `stop.signal.aborted` is set.
- **Error text:** `controllers.notTrainer` (en + pl) still says "Pick the Zwift Play, Click or Ride itself". Make it generic ("Pick the controller itself").
- **Duplication (optional):** `ObcController` repeats most of `ZwiftController`. A small shared helper is welcome but not required.

### 7. Tests to add

- An analog state on a mapped id (0 → 0x02 → 0) is exactly one press.
- Partial release and re-press of a multi-id press: `[0x01, 0x30, 0x14]` pressed, then 0x14 released and pressed again while the others are held.
- The same id twice in one frame.
- The missed-release case from item 4.
- If detection stays partly in `core` (e.g. a `kindFromServices` helper), test it there, including a device with both services.

### 8. Housekeeping

- Please rebase onto `development` and retarget the PR to `development`. I've just released 0.6.1, so `CHANGELOG.md` (your entry goes under the new `## Unreleased`) and `DESIGN.md` (D33 changed) will conflict.
- Add OpenBikeControl to the supported hardware in README.md.
- In the PR description, list what you tested on real hardware (device, firmware, OS) and what you couldn't.

### Testing before merge

Once 1 and 2 are in, I'll test on Windows 10 with my Zwift Click v2 (new add, re-add while connected, reconnect after sleep) and check that the KICKR CORE 2 and heart rate strap still connect as before. If you can test a native OpenBikeControl device or BikeControl over real Bluetooth, please add the results here.

Thanks again. Happy to answer questions on any of these.
