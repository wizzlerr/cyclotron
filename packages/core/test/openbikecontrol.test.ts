import { describe, expect, it } from 'vitest'
import {
  controllerKind,
  OBC_SUPPORTED_IDS,
  ObcButtonTracker,
  obcAppInfo,
  obcButtonStates,
} from '../src'

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

/** One message with every id at `state`. */
const msg = (ids: number[], state: number): Uint8Array =>
  Uint8Array.of(0x01, ...ids.flatMap((id) => [id, state]))

describe('ObcButtonTracker', () => {
  it('maps shifting to + / − and navigation to the D-pad, A and B', () => {
    const t = new ObcButtonTracker()
    const press = (id: number): string | undefined => {
      const p = t.update(msg([id], 1), 'riding')
      t.update(msg([id], 0), 'riding')
      return p
    }
    expect([0x01, 0x02, 0x30, 0x31].map(press)).toEqual([
      'shiftUpR',
      'shiftDownL',
      'shiftUpR',
      'shiftDownL',
    ])
    expect([0x10, 0x11, 0x12, 0x13, 0x14, 0x15].map(press)).toEqual([
      'up',
      'down',
      'left',
      'right',
      'a',
      'b',
    ])
    // Steering, emotes and unknown ids are ignored.
    expect(press(0x18)).toBeUndefined()
    expect(press(0xa0)).toBeUndefined()
  })

  it('reports a press once until it is released (messages only carry changes)', () => {
    const t = new ObcButtonTracker()
    expect(t.update(msg([0x01], 1), 'riding')).toBe('shiftUpR')
    expect(t.update(msg([0x01], 1), 'riding')).toBeUndefined()
    // Another button changing doesn't repeat the held one.
    expect(t.update(msg([0x10], 1), 'riding')).toBe('up')
    expect(t.update(msg([0x10], 0), 'riding')).toBeUndefined()
    expect(t.update(msg([0x01], 0), 'riding')).toBeUndefined()
    expect(t.update(msg([0x01], 1), 'riding')).toBe('shiftUpR')
  })

  it.each([
    // ids of one physical press, then the button chosen while riding and in menus
    [[0x01, 0x30, 0x14], 'shiftUpR', 'a'],
    [[0x02, 0x31, 0x15], 'shiftDownL', 'b'],
    [[0x30, 0x14], 'shiftUpR', 'a'],
    [[0x01, 0x10], 'shiftUpR', 'up'],
    [[0x31, 0x11], 'shiftDownL', 'down'],
    [[0x13, 0x14], 'right', 'right'],
    [[0x14, 0x12], 'left', 'left'],
    [[0x01, 0x30], 'shiftUpR', 'shiftUpR'],
    [[0x31, 0x02], 'shiftDownL', 'shiftDownL'],
    [[0x01, 0xa0], 'shiftUpR', 'shiftUpR'],
  ])('runs one action for %j (riding %s, menus %s)', (ids, riding, menus) => {
    for (const [context, want] of [
      ['riding', riding],
      ['menus', menus],
    ] as const) {
      const t = new ObcButtonTracker()
      expect(t.update(msg(ids, 1), context)).toBe(want)
      // Releasing, all at once or one by one, presses nothing.
      for (const id of ids) expect(t.update(msg([id], 0), context)).toBeUndefined()
    }
  })

  it('treats ids pressed in separate messages as separate presses', () => {
    const t = new ObcButtonTracker()
    expect(t.update(msg([0x01], 1), 'menus')).toBe('shiftUpR')
    expect(t.update(msg([0x14], 1), 'menus')).toBe('a')
    expect(t.update(msg([0x01, 0x14], 0), 'menus')).toBeUndefined()
  })
})

describe('controllerKind', () => {
  const OBC = 'd273f680-d548-419d-b9d1-fa0472345229'
  it('tells OpenBikeControl from Zwift by the advertisement', () => {
    expect(controllerKind([OBC], [])).toBe('obc')
    expect(controllerKind([OBC.toUpperCase()], [])).toBe('obc')
    expect(controllerKind([], [0x094a])).toBe('zwift')
    expect(controllerKind(['0000fc82-0000-1000-8000-00805f9b34fb'], [])).toBe('zwift')
    expect(controllerKind(['00000001-19ca-4651-86e5-fa29dcdd09d1'], [])).toBe('zwift')
  })

  it('prefers OpenBikeControl when both are advertised', () => {
    expect(controllerKind([OBC], [0x094a])).toBe('obc')
  })

  it('is undefined for anything else', () => {
    expect(controllerKind(['0000180d-0000-1000-8000-00805f9b34fb'], [0x0059])).toBeUndefined()
    expect(controllerKind([], [])).toBeUndefined()
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
