import { describe, expect, it } from 'vitest'
import {
  controlCommand,
  FtmsCommandQueue,
  FtmsOp,
  toHex,
  type ControlPointResponse,
  type FtmsCommand,
} from '../src'

const response = (op: number, resultCode = 0x01): ControlPointResponse => ({
  requestOp: op,
  resultCode,
  result: resultCode === 0x01 ? 'success' : 'failed',
  ok: resultCode === 0x01,
})

/** A fake transport whose writes resolve only when the test says so. */
function fakeTrainer() {
  const sent: string[] = []
  const pending: {
    op: number
    resolve: (r: ControlPointResponse) => void
    reject: (e: Error) => void
  }[] = []
  const send = (bytes: Uint8Array): Promise<ControlPointResponse> => {
    sent.push(toHex(bytes))
    return new Promise((resolve, reject) => pending.push({ op: bytes[0]!, resolve, reject }))
  }
  const respond = async (resultCode = 0x01): Promise<void> => {
    const p = pending.shift()!
    p.resolve(response(p.op, resultCode))
    await flush()
  }
  const fail = async (): Promise<void> => {
    pending.shift()!.reject(new Error('timeout'))
    await flush()
  }
  return { sent, pending, send, respond, fail }
}

/** Lets queued promise callbacks run. */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

const erg = (watts: number): FtmsCommand => controlCommand({ kind: 'erg', watts })

describe('FtmsCommandQueue', () => {
  it('keeps one write in flight at a time', async () => {
    const t = fakeTrainer()
    const q = new FtmsCommandQueue(t.send)
    const a = q.enqueue({ label: 'request control', bytes: Uint8Array.of(FtmsOp.requestControl) })
    const b = q.enqueue({ label: 'start', bytes: Uint8Array.of(FtmsOp.startOrResume) })
    await flush()
    expect(t.sent).toEqual(['00'])
    await t.respond()
    expect(t.sent).toEqual(['00', '07'])
    await t.respond()
    expect((await a).requestOp).toBe(0x00)
    expect((await b).requestOp).toBe(0x07)
  })

  it('coalesces waiting commands with the same slot', async () => {
    const t = fakeTrainer()
    const q = new FtmsCommandQueue(t.send)
    const first = q.enqueue(erg(150))
    const second = q.enqueue(erg(160))
    const third = q.enqueue(erg(170))
    expect(q.size).toBe(1)
    await t.respond()
    await t.respond()
    // 150 was already in flight; 160 was replaced by 170 before it was sent.
    expect(t.sent).toEqual(['05 96 00', '05 aa 00'])
    await Promise.all([first, second, third])
  })

  it('returns non-success responses instead of throwing', async () => {
    const t = fakeTrainer()
    const q = new FtmsCommandQueue(t.send)
    const r = q.enqueue(erg(150))
    await t.respond(0x03)
    expect((await r).ok).toBe(false)
  })

  it('retries failed writes, then gives up', async () => {
    const t = fakeTrainer()
    const q = new FtmsCommandQueue(t.send, 2)
    const r = q.enqueue(erg(150))
    const result = r.catch((e: unknown) => e)
    await t.fail()
    await t.fail()
    await t.fail()
    expect(t.sent).toHaveLength(3)
    expect(await result).toBeInstanceOf(Error)
  })

  it('requests control again when the trainer says control is not permitted', async () => {
    const t = fakeTrainer()
    const q = new FtmsCommandQueue(t.send)
    const r = q.enqueue(erg(150))
    await t.respond(0x05)
    await t.respond()
    await t.respond()
    expect(t.sent).toEqual(['05 96 00', '00', '05 96 00'])
    expect((await r).ok).toBe(true)
  })

  it('rejects waiting commands on clear', async () => {
    const t = fakeTrainer()
    const q = new FtmsCommandQueue(t.send, 0)
    void q.enqueue(erg(150)).catch(() => {})
    const waiting = q.enqueue({ label: 'start', bytes: Uint8Array.of(FtmsOp.startOrResume) })
    q.clear(new Error('disconnected'))
    await expect(waiting).rejects.toThrow('disconnected')
  })
})

describe('controlCommand', () => {
  it('maps each control to its Control Point bytes', () => {
    expect(toHex(controlCommand({ kind: 'erg', watts: 200 }).bytes)).toBe('05 c8 00')
    // Free ride: simulation at 0 % with default wind, Crr 0.004, Cw 0.51.
    expect(toHex(controlCommand({ kind: 'free' }).bytes)).toBe('11 00 00 00 00 28 33')
    expect(toHex(controlCommand({ kind: 'simulation', gradePct: 5 }).bytes)).toBe(
      '11 00 00 f4 01 28 33',
    )
    expect(toHex(controlCommand({ kind: 'resistance', level: 100 }).bytes)).toBe('04 ff')
  })
})
