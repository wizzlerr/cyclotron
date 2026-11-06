// OpenBikeControl controllers (buttons only): an open, MIT-licensed protocol
// (https://github.com/OpenBikeControl/openbikecontrol-protocol), spoken by some controllers
// directly and by bridge apps for others (Zwift, Shimano, SRAM).
// Button state notifications are [0x01][button id][state]…, carrying only the buttons that
// changed. Implemented from the spec (PROTOCOL.md, BLE.md), not copied code.

import type { ZwiftButton } from './zwift'

export const OBC_SERVICE = 'd273f680-d548-419d-b9d1-fa0472345229'
export const OBC_BUTTON_STATE = 'd273f681-d548-419d-b9d1-fa0472345229'
export const OBC_APP_INFO = 'd273f683-d548-419d-b9d1-fa0472345229'

const MSG_BUTTON_STATE = 0x01
const MSG_APP_INFO = 0x04

/**
 * Standard OpenBikeControl button ids onto the Zwift buttons the rest of the app understands, so
 * navigation (lib/padnav) and the ride actions (lib/padmap) work unchanged: shift up and
 * "increase difficulty" are the right side (+), shift down and "decrease" the left (−).
 */
const OBC_BUTTONS: Record<number, ZwiftButton> = {
  0x01: 'shiftUpR',
  0x02: 'shiftDownL',
  0x10: 'up',
  0x11: 'down',
  0x12: 'left',
  0x13: 'right',
  0x14: 'a',
  0x15: 'b',
  0x30: 'shiftUpR',
  0x31: 'shiftDownL',
}

/** The ids we act on, sent to the device so it can adapt its buttons. */
export const OBC_SUPPORTED_IDS: readonly number[] = Object.keys(OBC_BUTTONS).map(Number)

/** Button id → state pairs of a button state message, or undefined for anything else. */
export function obcButtonStates(frame: Uint8Array): Map<number, number> | undefined {
  if (frame.length < 1 || frame[0] !== MSG_BUTTON_STATE) return undefined
  const states = new Map<number, number>()
  for (let i = 1; i + 1 < frame.length; i += 2) states.set(frame[i]!, frame[i + 1]!)
  return states
}

/**
 * Turns button state messages into presses: mapped buttons held now that weren't before. A
 * message only lists changed buttons, so the state of every id is kept; several ids that map to
 * the same button (a device may send shift up and "increase difficulty" together) press it once.
 */
export class ObcButtonTracker {
  private states = new Map<number, number>()
  private held = new Set<ZwiftButton>()

  update(frame: Uint8Array): ZwiftButton[] {
    const changed = obcButtonStates(frame)
    if (!changed) return []
    for (const [id, state] of changed) this.states.set(id, state)
    const now = new Set<ZwiftButton>()
    for (const [id, state] of this.states) {
      const button = OBC_BUTTONS[id]
      if (button && state !== 0) now.add(button)
    }
    const presses = [...now].filter((b) => !this.held.has(b))
    this.held = now
    return presses
  }
}

/** ASCII bytes, at most 32 (the spec's limit; UTF-8 is the same for ASCII). */
const ascii = (s: string): number[] => Array.from(s.slice(0, 32), (c) => c.charCodeAt(0) & 0x7f)

/** The App Information message: who we are and which button ids we use. */
export function obcAppInfo(
  appId: string,
  version: string,
  ids: readonly number[],
): Uint8Array<ArrayBuffer> {
  const id = ascii(appId)
  const ver = ascii(version)
  return Uint8Array.of(MSG_APP_INFO, 0x01, id.length, ...id, ver.length, ...ver, ids.length, ...ids)
}
