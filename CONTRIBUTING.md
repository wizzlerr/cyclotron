# Contributing to Cyclotron

Thanks for helping. Cyclotron is a small, single-rider training app that one person maintains, so
it stays deliberately lightweight. These guidelines say what a pull request needs to get merged and
what a review checks. Following them saves you and the maintainer a round trip.

## Before you start

- **Open an issue first for anything bigger than a fix.** Features are added when riders ask for
  them and they fit the app. A short issue ("I'd like X because Y, here's how I'd do it") avoids
  work that can't be merged.
- **Read [DESIGN.md](DESIGN.md) §2 (decisions) for the area you touch.** Many "why not just…"
  questions are answered there, including the alternatives that were rejected.
- **Target the `development` branch.** `master` only receives release merges.

## What every pull request needs

1. **Checks pass locally:**

   ```sh
   pnpm test && pnpm typecheck && pnpm lint && pnpm format:check
   ```

2. **Tests for new logic.** `packages/core` is pure: no I/O, no `Date.now()`, no DOM; time and
   data are passed in. Everything in it gets Vitest tests, including the edge cases (bad input,
   repeated or out-of-order events, boundaries), not only the happy path.
3. **Both languages.** User-visible text goes in the area's file in
   `apps/desktop/src/renderer/src/i18n/messages/`, in `en` and `pl` (`pl: typeof en` makes a
   missing string a type error). Use `formatNumber` / `formatDate`. `core` returns codes, not
   sentences.
4. **A CHANGELOG line** under `## Unreleased` for anything a rider would notice, written for
   riders (what changed for them), not for developers.
5. **A decision entry** in DESIGN.md §2 when you choose between real alternatives (new protocol,
   new dependency, new storage, new permission). Say what was rejected and why.
6. **A small, focused diff.** One feature or fix per pull request; no drive-by reformatting or
   unrelated refactors.

## What the review checks

Reviews look at these, roughly in this order. Things in the first group block a merge.

### Blocking

- **No regressions for existing riders.** The most important rule. Anything already working
  (trainer, heart rate strap, Zwift controllers, recording, uploads) must keep working the same
  way. If a new code path sits in front of an existing one, the old behaviour must be the fallback
  when the new path can't decide, not an error.
- **Bluetooth works in real conditions.** Assume Windows, a weak signal (the PC can be several
  metres and a wall away), devices that go to sleep, notifications that get lost, and reconnects
  in the middle of a ride. Timeouts must be generous and never block a ride, and a lost message
  must not leave the app in a stuck state.
- **Electron security defaults stay on.** `contextIsolation`, `sandbox`, no `nodeIntegration`;
  the renderer talks to main only through the typed preload API. Don't enable experimental
  Chromium/Blink features for everyone to support one feature, unless there is no other way and
  it's agreed first.
- **The ride never depends on the network.** Bluetooth, the workout player and recording work
  offline.
- **Licences.** Code must be compatible with AGPL-3.0-or-later. Say where a protocol or algorithm
  comes from; don't copy code with an incompatible licence.

### Expected

- **Tested on hardware, or said so.** State what you tested on (device, firmware, OS) and what
  you couldn't. Mocks and unit tests are welcome but don't replace a real device for Bluetooth
  changes; the maintainer can test a KICKR CORE 2, a heart rate strap and a Zwift Click v2.
- **Follows the existing shape.** New devices look like the existing ones (`BleLink` for
  connection and reconnect, `Emitter` for events, diagnostics through `logEvent` / `traceBle`).
  Stores don't reach into UI navigation state; pass context in.
- **Error messages help the rider.** They say what happened and what to do, in both languages,
  and don't name only some of the devices the path serves.
- **Logs are honest.** No warnings on the normal path; the diagnostic report is used to debug
  riders' problems.
- **Docs updated** where riders or contributors would look: README for supported hardware,
  BACKLOG.md for new tasks.

### Nice to have

- Shared code instead of copies when two classes do the same thing.
- Comments that explain *why*, not *what*.

## Compatibility reports

Reports that a trainer or controller works (or doesn't) are very useful even without code: open
an issue with the model, firmware version, operating system, what worked and, if something
failed, a diagnostic report (Settings → App → Problem?).
