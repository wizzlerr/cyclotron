// FTMS Control Point command queue (E2-5): one write in flight at a time, retries, and
// coalescing so a burst of ERG changes only sends the latest target. The transport (write +
// wait for the response indication, with a timeout) is injected, so this stays pure.

import type { TrainerControl } from '../sim/trainer-sim'
import {
  encodeRequestControl,
  encodeSetIndoorBikeSimulation,
  encodeSetTargetPower,
  encodeSetTargetResistance,
  FtmsOp,
  type ControlPointResponse,
} from './ftms'

export interface FtmsCommand {
  label: string
  bytes: Uint8Array
  /** While waiting, a newer command with the same slot replaces this one. */
  slot?: string
}

/** Writes a command and resolves with the trainer's response; rejects on failure or timeout. */
export type FtmsSend = (bytes: Uint8Array) => Promise<ControlPointResponse>

interface Entry {
  command: FtmsCommand
  waiters: { resolve: (r: ControlPointResponse) => void; reject: (e: unknown) => void }[]
}

const NOT_PERMITTED = 0x05

export class FtmsCommandQueue {
  private waiting: Entry[] = []
  private busy = false

  constructor(
    private send: FtmsSend,
    private retries = 2,
  ) {}

  /** Number of commands waiting (not counting the one in flight). */
  get size(): number {
    return this.waiting.length
  }

  /**
   * Resolves with the trainer's response, including non-success results such as "invalid
   * parameter". A coalesced command resolves with the response to the command that replaced it.
   */
  enqueue(command: FtmsCommand): Promise<ControlPointResponse> {
    return new Promise((resolve, reject) => {
      const same = command.slot && this.waiting.find((e) => e.command.slot === command.slot)
      if (same) {
        same.command = command
        same.waiters.push({ resolve, reject })
      } else {
        this.waiting.push({ command, waiters: [{ resolve, reject }] })
      }
      void this.pump()
    })
  }

  /** Rejects everything waiting, e.g. when the connection drops. */
  clear(reason: unknown): void {
    const dropped = this.waiting
    this.waiting = []
    for (const e of dropped) for (const w of e.waiters) w.reject(reason)
  }

  private async pump(): Promise<void> {
    if (this.busy) return
    this.busy = true
    for (let e = this.waiting.shift(); e; e = this.waiting.shift()) {
      try {
        const r = await this.run(e.command)
        for (const w of e.waiters) w.resolve(r)
      } catch (err) {
        for (const w of e.waiters) w.reject(err)
      }
    }
    this.busy = false
  }

  private async run(command: FtmsCommand): Promise<ControlPointResponse> {
    let lastError: unknown
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        let r = await this.send(command.bytes)
        // The trainer forgot who has control (e.g. another app took it): ask again, then retry.
        if (r.resultCode === NOT_PERMITTED && command.bytes[0] !== FtmsOp.requestControl) {
          await this.send(encodeRequestControl())
          r = await this.send(command.bytes)
        }
        return r
      } catch (e) {
        lastError = e
      }
    }
    throw lastError
  }
}

/** The Control Point command that puts the trainer into `control`. All share the "target" slot. */
export function controlCommand(control: TrainerControl): FtmsCommand {
  switch (control.kind) {
    case 'erg':
      return {
        label: `ERG ${Math.round(control.watts)} W`,
        bytes: encodeSetTargetPower(control.watts),
        slot: 'target',
      }
    case 'free':
      // Free ride = simulation on a flat road.
      return {
        label: 'free ride',
        bytes: encodeSetIndoorBikeSimulation({ gradePct: 0 }),
        slot: 'target',
      }
    case 'simulation':
      return {
        label: `grade ${control.gradePct} %`,
        bytes: encodeSetIndoorBikeSimulation({ gradePct: control.gradePct }),
        slot: 'target',
      }
    case 'resistance':
      // 0–100 % mapped onto the FTMS v1.0 uint8 range (0–25.5). E2-3 should check this against
      // the KICKR's Supported Resistance Level Range.
      return {
        label: `resistance ${control.level} %`,
        bytes: encodeSetTargetResistance(control.level * 0.255),
        slot: 'target',
      }
  }
}
