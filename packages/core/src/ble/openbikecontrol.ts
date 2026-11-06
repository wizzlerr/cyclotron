// OpenBikeControl controllers (buttons only): an open, MIT-licensed protocol
// (https://github.com/OpenBikeControl/openbikecontrol-protocol), spoken by some controllers
// directly and by bridge apps for others (Zwift, Shimano, SRAM).
// Button state notifications are [0x01][button id][state]…, carrying only the buttons that
// changed. Implemented from the spec (PROTOCOL.md, BLE.md), not copied code.

import { ZWIFT_COMPANY_ID, ZWIFT_RIDE_SERVICE, ZWIFT_SERVICE, type ZwiftButton } from './zwift'

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

/** Where the press lands: the Ride screen (ride actions) or anywhere else (navigation). */
export type ObcContext = 'riding' | 'menus'

const SHIFT = [0x01, 0x02]
const DIFFICULTY = [0x30, 0x31]
const DPAD = [0x10, 0x11, 0x12, 0x13]
const SELECT_BACK = [0x14, 0x15]
/** Which of several ids sent for one press wins, first group first. */
const PRIORITY: Record<ObcContext, number[]> = {
  riding: [...SHIFT, ...DIFFICULTY, ...DPAD, ...SELECT_BACK],
  menus: [...DPAD, ...SELECT_BACK, ...SHIFT, ...DIFFICULTY],
}

/** Button id → state pairs of a button state message, or undefined for anything else. */
export function obcButtonStates(frame: Uint8Array): Map<number, number> | undefined {
  if (frame.length < 1 || frame[0] !== MSG_BUTTON_STATE) return undefined
  const states = new Map<number, number>()
  for (let i = 1; i + 1 < frame.length; i += 2) states.set(frame[i]!, frame[i + 1]!)
  return states
}

/**
 * Turns button state messages into presses. A message only lists changed buttons, so the state of
 * every id is kept. One physical button may send several ids in one message (shift up, "increase
 * difficulty" and select, so each app finds one it knows): all ids a message newly presses are one
 * press, and the context picks which one counts, so it runs exactly one action.
 */
export class ObcButtonTracker {
  private states = new Map<number, number>()

  update(frame: Uint8Array, context: ObcContext): ZwiftButton | undefined {
    const changed = obcButtonStates(frame)
    if (!changed) return undefined
    const pressed = new Set<number>()
    for (const [id, state] of changed) {
      if (state !== 0 && !this.states.get(id)) pressed.add(id)
      this.states.set(id, state)
    }
    const id = PRIORITY[context].find((x) => pressed.has(x))
    return id === undefined ? undefined : OBC_BUTTONS[id]
  }
}

export type ControllerKind = 'zwift' | 'obc'

/**
 * What a controller is, from its advertisement: the OpenBikeControl service, or Zwift's company
 * id (or service). OpenBikeControl wins when both are there (a bridge app may advertise both).
 */
export function controllerKind(
  uuids: readonly string[],
  manufacturerIds: readonly number[],
): ControllerKind | undefined {
  const services = uuids.map((u) => u.toLowerCase())
  if (services.includes(OBC_SERVICE)) return 'obc'
  if (manufacturerIds.includes(ZWIFT_COMPANY_ID)) return 'zwift'
  if (services.includes(ZWIFT_SERVICE) || services.includes(ZWIFT_RIDE_SERVICE)) return 'zwift'
  return undefined
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
