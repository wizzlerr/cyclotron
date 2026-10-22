// Zwift Play / Click / Ride controllers (buttons only). The protocol is reverse-engineered by the
// community (no official spec): after writing "RideOn" to the sync characteristic, current
// firmware sends unencrypted protobuf button frames: [type byte][protobuf]. Implemented from the
// protocol description (DESIGN.md §9c), not copied code.

export const ZWIFT_SERVICE = '00000001-19ca-4651-86e5-fa29dcdd09d1'
/** Zwift Ride, Click v2 and Play firmware 2. */
export const ZWIFT_RIDE_SERVICE = '0000fc82-0000-1000-8000-00805f9b34fb'
export const ZWIFT_ASYNC = '00000002-19ca-4651-86e5-fa29dcdd09d1'
export const ZWIFT_SYNC_RX = '00000003-19ca-4651-86e5-fa29dcdd09d1'
export const ZWIFT_SYNC_TX = '00000004-19ca-4651-86e5-fa29dcdd09d1'
/** Zwift, Inc. Bluetooth company id (manufacturer data). */
export const ZWIFT_COMPANY_ID = 0x094a
/** "RideOn" in ASCII: the handshake. */
export const RIDE_ON = Uint8Array.of(0x52, 0x69, 0x64, 0x65, 0x4f, 0x6e)

export type ZwiftButton =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'a'
  | 'b'
  | 'y'
  | 'z'
  | 'shiftUpL'
  | 'shiftDownL'
  | 'shiftUpR'
  | 'shiftDownR'
  | 'powerUpL'
  | 'powerUpR'
  | 'onOffL'
  | 'onOffR'
  | 'paddleL'
  | 'paddleR'

const MSG_PLAY = 0x07
const MSG_RIDE = 0x23
const MSG_CLICK = 0x37

/** One protobuf field: varints as numbers, length-delimited as bytes. */
type Field = { no: number; value: number } | { no: number; bytes: Uint8Array }

function readVarint(b: Uint8Array, o: { i: number }): number {
  let v = 0
  let shift = 0
  while (o.i < b.length) {
    const byte = b[o.i++]!
    v += (byte & 0x7f) * 2 ** shift
    if (!(byte & 0x80)) return v
    shift += 7
  }
  throw new RangeError('truncated varint')
}

/** Just enough protobuf for these frames: varint and length-delimited fields. */
export function protobufFields(b: Uint8Array): Field[] {
  const out: Field[] = []
  const o = { i: 0 }
  while (o.i < b.length) {
    const tag = readVarint(b, o)
    const no = Math.floor(tag / 8)
    const wire = tag & 7
    if (wire === 0) out.push({ no, value: readVarint(b, o) })
    else if (wire === 2) {
      const len = readVarint(b, o)
      out.push({ no, bytes: b.subarray(o.i, o.i + len) })
      o.i += len
    } else if (wire === 5) o.i += 4
    else if (wire === 1) o.i += 8
    else throw new RangeError(`unsupported wire type ${wire}`)
  }
  return out
}

const zigzag = (n: number): number => (n % 2 === 0 ? n / 2 : -(n + 1) / 2)
const varint = (fields: Field[], no: number): number | undefined => {
  const f = fields.find((x) => x.no === no && 'value' in x)
  return f && 'value' in f ? f.value : undefined
}

/** Ride / Click v2 / Play fw2 button bits; a cleared bit means pressed. */
const RIDE_BITS: [number, ZwiftButton][] = [
  [0x1, 'left'],
  [0x2, 'up'],
  [0x4, 'right'],
  [0x8, 'down'],
  [0x10, 'a'],
  [0x20, 'b'],
  [0x40, 'y'],
  [0x80, 'z'],
  [0x100, 'shiftUpL'],
  [0x200, 'shiftDownL'],
  [0x400, 'powerUpL'],
  [0x800, 'onOffL'],
  [0x1000, 'shiftUpR'],
  [0x2000, 'shiftDownR'],
  [0x4000, 'powerUpR'],
  [0x8000, 'onOffR'],
]
const PADDLE_PLAY = 100
const PADDLE_RIDE = 25

/**
 * Buttons held in one notification, or undefined for frames that aren't button states (battery,
 * idle, handshake). Pressed is 0 in these protobufs, and proto3 omits zero fields, so a button
 * field that's missing means pressed.
 */
export function zwiftButtons(frame: Uint8Array): Set<ZwiftButton> | undefined {
  if (frame.length < 1) return undefined
  const type = frame[0]!
  if (type !== MSG_PLAY && type !== MSG_RIDE && type !== MSG_CLICK) return undefined
  let fields: Field[]
  try {
    fields = protobufFields(frame.subarray(1))
  } catch {
    return undefined
  }
  const held = new Set<ZwiftButton>()
  const pressed = (no: number): boolean => (varint(fields, no) ?? 0) === 0
  if (type === MSG_PLAY) {
    // Field 1: 0 = the right unit (A/B/Y/Z), 1 = the left unit (D-pad).
    const right = (varint(fields, 1) ?? 0) === 0
    const names: ZwiftButton[] = right
      ? ['y', 'z', 'a', 'b', 'shiftUpR', 'onOffR']
      : ['up', 'left', 'right', 'down', 'shiftDownL', 'onOffL']
    names.forEach((name, i) => pressed(i + 2) && held.add(name))
    const lr = zigzag(varint(fields, 8) ?? 0)
    if (Math.abs(lr) >= PADDLE_PLAY) held.add(right ? 'paddleR' : 'paddleL')
    return held
  }
  if (type === MSG_RIDE) {
    const map = varint(fields, 1) ?? 0
    for (const [bit, name] of RIDE_BITS) if (!(map & bit)) held.add(name)
    for (const f of fields) {
      if (f.no !== 3 || !('bytes' in f)) continue
      const sub = protobufFields(f.bytes)
      const location = varint(sub, 1) ?? 0
      if (Math.abs(zigzag(varint(sub, 2) ?? 0)) >= PADDLE_RIDE) {
        held.add(location === 0 ? 'paddleL' : 'paddleR')
      }
    }
    return held
  }
  if (type === MSG_CLICK) {
    if (pressed(1)) held.add('shiftUpR')
    if (pressed(2)) held.add('shiftDownR')
    return held
  }
  return undefined
}

/** Turns repeated button-state frames into presses: buttons held now that weren't before. */
export class ZwiftButtonTracker {
  private held = new Set<ZwiftButton>()

  update(frame: Uint8Array): ZwiftButton[] {
    const now = zwiftButtons(frame)
    if (!now) return []
    const presses = [...now].filter((b) => !this.held.has(b))
    this.held = now
    return presses
  }
}

/**
 * The "+" and "−" buttons: shift buttons (a Play's right side button is +, its left one −, a
 * Click's two are + and −) and paddles. The D-pad is for moving around the app, not for this.
 */
export function buttonDirection(b: ZwiftButton): 1 | -1 | 0 {
  if (b === 'shiftUpL' || b === 'shiftUpR' || b === 'paddleR') return 1
  if (b === 'shiftDownL' || b === 'shiftDownR' || b === 'paddleL') return -1
  return 0
}
