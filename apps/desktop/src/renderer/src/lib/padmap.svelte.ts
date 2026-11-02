// Which ride action each Zwift controller button runs (Settings → Controllers). The D-pad always
// moves the highlight (lib/padnav.svelte.ts), so it isn't mappable.

import { buttonDirection, type ZwiftButton } from '@cyclotron/core'
import { loadPref, savePref } from './prefs'

export type PadAction =
  'playPause' | 'skip' | 'end' | 'plus' | 'minus' | 'erg' | 'mute' | 'world' | 'none'

export const PAD_ACTIONS: readonly PadAction[] = [
  'playPause',
  'skip',
  'end',
  'plus',
  'minus',
  'erg',
  'mute',
  'world',
  'none',
]

export const MAPPABLE_BUTTONS: readonly ZwiftButton[] = [
  'a',
  'b',
  'y',
  'z',
  'shiftUpL',
  'shiftDownL',
  'paddleL',
  'shiftUpR',
  'shiftDownR',
  'paddleR',
  'powerUpL',
  'powerUpR',
  'onOffL',
  'onOffR',
]

/** Like Zwift: left side −, right side +; A start/pause, B ERG, Y mute, Z world. */
export function defaultAction(button: ZwiftButton): PadAction {
  const dir = buttonDirection(button)
  if (dir === 1) return 'plus'
  if (dir === -1) return 'minus'
  const fixed: Partial<Record<ZwiftButton, PadAction>> = {
    a: 'playPause',
    b: 'erg',
    y: 'mute',
    z: 'world',
  }
  return fixed[button] ?? 'none'
}

/** Short badge text for a button (PadHint). */
export function buttonBadge(button: ZwiftButton): string {
  if (button === 'a' || button === 'b' || button === 'y' || button === 'z') {
    return button.toUpperCase()
  }
  if (button.startsWith('powerUp')) return 'P'
  if (button.startsWith('onOff')) return '⏻'
  return buttonDirection(button) === 1 ? '+' : buttonDirection(button) === -1 ? '−' : '?'
}

const KEY = 'cyclotron.padMap'
const ACTIONS = new Set<string>(PAD_ACTIONS)

function load(): Partial<Record<ZwiftButton, PadAction>> {
  const saved = loadPref<Record<string, string>>(KEY)
  if (!saved || typeof saved !== 'object') return {}
  const out: Partial<Record<ZwiftButton, PadAction>> = {}
  for (const b of MAPPABLE_BUTTONS) {
    const a = saved[b]
    if (a && ACTIONS.has(a)) out[b] = a as PadAction
  }
  return out
}

class PadMap {
  /** Only buttons changed from their default. */
  custom = $state.raw<Partial<Record<ZwiftButton, PadAction>>>(load())

  action(button: ZwiftButton): PadAction {
    if (!MAPPABLE_BUTTONS.includes(button)) return 'none'
    return this.custom[button] ?? defaultAction(button)
  }

  /** The buttons that run `action`, in MAPPABLE_BUTTONS order. */
  buttons(action: PadAction): ZwiftButton[] {
    return MAPPABLE_BUTTONS.filter((b) => this.action(b) === action)
  }

  get isDefault(): boolean {
    return Object.keys(this.custom).length === 0
  }

  set(button: ZwiftButton, action: PadAction): void {
    const next = { ...this.custom }
    if (action === defaultAction(button)) delete next[button]
    else next[button] = action
    this.save(next)
  }

  reset(): void {
    this.save({})
  }

  private save(next: Partial<Record<ZwiftButton, PadAction>>): void {
    this.custom = next
    savePref(KEY, next)
  }
}

export const padmap = new PadMap()
