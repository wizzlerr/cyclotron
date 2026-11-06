import { describe, expect, it } from 'vitest'
import { OBC_SUPPORTED_IDS, ObcButtonTracker, obcAppInfo, obcButtonStates } from '../src'

describe('obcButtonStates', () => {
  it('reads button id / state pairs (spec examples)', () => {
    expect(obcButtonStates(Uint8Array.of(0x01, 0x01, 0x01))).toEqual(new Map([[0x01, 1]]))
    expect(obcButtonStates(Uint8Array.of(0x01, 0x01, 0x01, 0x02, 0x00))).toEqual(
      new Map([
        [0x01, 1],
        [0x02, 0],
      ]),
    )
  })

  it('ignores other message types and a dangling byte', () => {
    expect(obcButtonStates(Uint8Array.of(0x02, 0x55, 0x01))).toBeUndefined()
    expect(obcButtonStates(Uint8Array.of())).toBeUndefined()
    expect(obcButtonStates(Uint8Array.of(0x01, 0x14))).toEqual(new Map())
  })
})

describe('ObcButtonTracker', () => {
  it('maps shifting to + / − and navigation to the D-pad, A and B', () => {
    const t = new ObcButtonTracker()
    const press = (id: number): string[] => {
      const p = t.update(Uint8Array.of(0x01, id, 0x01))
      t.update(Uint8Array.of(0x01, id, 0x00))
      return p
    }
    expect(press(0x01)).toEqual(['shiftUpR'])
    expect(press(0x02)).toEqual(['shiftDownL'])
    expect(press(0x30)).toEqual(['shiftUpR'])
    expect(press(0x31)).toEqual(['shiftDownL'])
    expect([0x10, 0x11, 0x12, 0x13, 0x14, 0x15].map(press)).toEqual([
      ['up'],
      ['down'],
      ['left'],
      ['right'],
      ['a'],
      ['b'],
    ])
    // Steering, emotes and unknown ids are ignored.
    expect(press(0x18)).toEqual([])
    expect(press(0xa0)).toEqual([])
  })

  it('reports a press once until it is released (messages only carry changes)', () => {
    const t = new ObcButtonTracker()
    expect(t.update(Uint8Array.of(0x01, 0x01, 0x01))).toEqual(['shiftUpR'])
    // Another button changing doesn't repeat the held one.
    expect(t.update(Uint8Array.of(0x01, 0x10, 0x01))).toEqual(['up'])
    expect(t.update(Uint8Array.of(0x01, 0x10, 0x00))).toEqual([])
    expect(t.update(Uint8Array.of(0x01, 0x01, 0x00))).toEqual([])
    expect(t.update(Uint8Array.of(0x01, 0x01, 0x01))).toEqual(['shiftUpR'])
  })

  it('presses once for several ids of the same button in one message', () => {
    const t = new ObcButtonTracker()
    // Shift up + increase difficulty, as a device may send for one physical button.
    expect(t.update(Uint8Array.of(0x01, 0x01, 0x01, 0x30, 0x01))).toEqual(['shiftUpR'])
    expect(t.update(Uint8Array.of(0x01, 0x01, 0x00))).toEqual([])
    expect(t.update(Uint8Array.of(0x01, 0x30, 0x00))).toEqual([])
    expect(t.update(Uint8Array.of(0x01, 0x30, 0x01))).toEqual(['shiftUpR'])
  })
})

describe('obcAppInfo', () => {
  it('encodes the spec example', () => {
    const bytes = obcAppInfo('zwift', '1.52.0', [0x01, 0x02, 0x10, 0x14])
    expect([...bytes]).toEqual([
      0x04,
      0x01,
      0x05,
      ...'zwift'.split('').map((c) => c.charCodeAt(0)),
      0x06,
      ...'1.52.0'.split('').map((c) => c.charCodeAt(0)),
      0x04,
      0x01,
      0x02,
      0x10,
      0x14,
    ])
  })

  it('lists the ids we act on', () => {
    expect([...OBC_SUPPORTED_IDS].sort((a, b) => a - b)).toEqual([
      0x01, 0x02, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x30, 0x31,
    ])
  })
})
