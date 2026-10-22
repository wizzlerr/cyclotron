import { toHex } from '@cyclotron/core'

// Diagnostics (see main/log.ts): a ring buffer of recent Bluetooth packets and events for the
// diagnostic report, and notable events (connects, errors, refused commands) in the log file.

const MAX_TRACE = 2000
const trace: string[] = []
let started = performance.now()

const stamp = (): string => ((performance.now() - started) / 1000).toFixed(2).padStart(9)

/** A raw packet or low-level event, kept in memory only (the last MAX_TRACE). */
export function traceBle(source: string, what: string, data?: DataView | Uint8Array): void {
  trace.push(`${stamp()} ${source} ${what}${data ? ` ${toHex(data)}` : ''}`)
  if (trace.length > MAX_TRACE) trace.splice(0, trace.length - MAX_TRACE)
}

/** A notable event: kept in the trace and written to the log file. */
export function logEvent(level: 'info' | 'warn' | 'error', message: string): void {
  trace.push(`${stamp()} ${level} ${message}`)
  if (trace.length > MAX_TRACE) trace.splice(0, trace.length - MAX_TRACE)
  try {
    window.cyclotron.diag.log(level, message)
  } catch {
    // Diagnostics never break the app.
  }
}

export function bleTrace(): string[] {
  return [...trace]
}

/** For tests and a fresh capture. */
export function resetTrace(): void {
  trace.length = 0
  started = performance.now()
}
