import { describe, expect, it } from 'vitest'
import { buttonDirection, protobufFields, ZwiftButtonTracker, zwiftButtons } from '../src'

/** Varint field `no` = `value`. */
const vf = (no: number, value: number): number[] => {
  const out = [no * 8]
  let v = value
  do {
    let byte = v & 0x7f
    v = Math.floor(v / 128)
    if (v) byte |= 0x80
    out.push(byte)
  } while (v)
  return out
}
const zz = (n: number): number => (n >= 0 ? n * 2 : -n * 2 - 1)
const frame = (type: number, ...fields: number[][]): Uint8Array =>
  Uint8Array.of(type, ...fields.flat())

describe('protobufFields', () => {
  it('reads varint and nested fields', () => {
    const inner = [...vf(1, 1), ...vf(2, zz(-30))]
    const f = protobufFields(Uint8Array.of(...vf(1, 0xffffffff), 0x1a, inner.length, ...inner))
    expect(f[0]).toEqual({ no: 1, value: 0xffffffff })
    expect(f[1]!.no).toBe(3)
  })
})

describe('zwiftButtons', () => {
  it('reads the Play right unit (0 = pressed, missing = pressed)', () => {
    // RightPad 0 (right unit), Y released, Z released, A pressed (omitted), B released, shift/on-off released.
    const f = frame(0x07, vf(2, 1), vf(3, 1), vf(5, 1), vf(6, 1), vf(7, 1))
    expect([...zwiftButtons(f)!]).toEqual(['a'])
  })

  it('reads the Play left unit and its paddle', () => {
    const f = frame(
      0x07,
      vf(1, 1),
      vf(2, 1),
      vf(3, 1),
      vf(4, 1),
      vf(5, 0),
      vf(6, 1),
      vf(7, 1),
      vf(8, zz(-100)),
    )
    expect([...zwiftButtons(f)!].sort()).toEqual(['down', 'paddleL'])
  })

  it('reads the Ride/Click v2 bitmask (cleared bit = pressed) and paddles', () => {
    expect([...zwiftButtons(frame(0x23, vf(1, 0xffffffff)))!]).toEqual([])
    const map = 0xffffffff & ~0x10 & ~0x2000 // A and right shift down
    const paddle = [...vf(1, 1), ...vf(2, zz(40))]
    const f = frame(0x23, vf(1, map >>> 0), [0x1a, paddle.length, ...paddle])
    expect([...zwiftButtons(f)!].sort()).toEqual(['a', 'paddleR', 'shiftDownR'])
  })

  it('reads Click v1 plus/minus and ignores other frames', () => {
    expect([...zwiftButtons(frame(0x37, vf(2, 1)))!]).toEqual(['shiftUpR'])
    expect(zwiftButtons(frame(0x19, [0x08, 0x50]))).toBeUndefined()
    expect(zwiftButtons(frame(0x15))).toBeUndefined()
  })

  it('ignores malformed button frames instead of throwing', () => {
    // Wire type 3 (group) isn't used by these protobufs; a Click sent one on a real device.
    expect(zwiftButtons(frame(0x23, [0x0b, 0x01]))).toBeUndefined()
    expect(zwiftButtons(frame(0x37, [0x08]))).toBeUndefined()
  })
})

describe('ZwiftButtonTracker', () => {
  it('reports a press once, however often the frame repeats', () => {
    const t = new ZwiftButtonTracker()
    const idle = frame(0x23, vf(1, 0xffffffff))
    const a = frame(0x23, vf(1, (0xffffffff & ~0x10) >>> 0))
    expect(t.update(idle)).toEqual([])
    expect(t.update(a)).toEqual(['a'])
    expect(t.update(a)).toEqual([])
    expect(t.update(idle)).toEqual([])
    expect(t.update(a)).toEqual(['a'])
  })

  it('maps shifting to more/less', () => {
    expect(buttonDirection('shiftUpR')).toBe(1)
    expect(buttonDirection('paddleL')).toBe(-1)
    expect(buttonDirection('a')).toBe(0)
  })
})
