import type { ZwiftButton } from '@cyclotron/core'
import { devices } from '../devices/devices.svelte'
import { Emitter } from '../devices/emitter'
import { nav } from '../nav.svelte'

// Controller navigation: the D-pad moves a highlight over the app's buttons, tabs and inputs, A
// presses the highlighted one, B backs out (closes a dialog, or drops the highlight). Buttons it
// doesn't use go to `unhandled`, which the Ride screen turns into ride actions. On the Ride screen
// the highlight fades after a few seconds without a press, so A goes back to start/pause.

const FOCUSABLE =
  'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'
const CLASS = 'pad-focus'
const RIDE_IDLE_MS = 5_000

type Direction = 'up' | 'down' | 'left' | 'right'
const DIRECTIONS = new Set<ZwiftButton>(['up', 'down', 'left', 'right'])

function visible(el: HTMLElement): boolean {
  if (el.closest('[inert], [hidden]')) return false
  if ((el as HTMLButtonElement).disabled) return false
  const r = el.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return false
  const style = getComputedStyle(el)
  return style.visibility !== 'hidden' && style.display !== 'none'
}

/** The open dialog, if any: navigation stays inside it. */
function scope(): ParentNode {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]')
  return dialogs.length ? dialogs[dialogs.length - 1]! : document
}

function candidates(): HTMLElement[] {
  return [...scope().querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible)
}

/**
 * The nearest candidate in a direction, by edge distance along it plus twice the sideways
 * offset, so a button straight below beats a closer one off to the side.
 */
export function nearest(
  from: DOMRect,
  dir: Direction,
  rects: { rect: DOMRect; i: number }[],
): number | undefined {
  const cx = from.left + from.width / 2
  const cy = from.top + from.height / 2
  let best: number | undefined
  let bestScore = Infinity
  for (const { rect: r, i } of rects) {
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    let along: number
    let side: number
    if (dir === 'down') {
      if (y <= cy + 1 || r.top < from.top + 1) continue
      along = Math.max(0, r.top - from.bottom)
      side = Math.max(0, r.left - from.right, from.left - r.right)
    } else if (dir === 'up') {
      if (y >= cy - 1 || r.bottom > from.bottom - 1) continue
      along = Math.max(0, from.top - r.bottom)
      side = Math.max(0, r.left - from.right, from.left - r.right)
    } else if (dir === 'right') {
      if (x <= cx + 1 || r.left < from.left + 1) continue
      along = Math.max(0, r.left - from.right)
      side = Math.max(0, r.top - from.bottom, from.top - r.bottom)
    } else {
      if (x >= cx - 1 || r.right > from.right - 1) continue
      along = Math.max(0, from.left - r.right)
      side = Math.max(0, r.top - from.bottom, from.top - r.bottom)
    }
    const score = along + side * 2 + Math.hypot(x - cx, y - cy) * 0.01
    if (score < bestScore) {
      bestScore = score
      best = i
    }
  }
  return best
}

class PadNav {
  /** The highlighted element (none until the D-pad is used). */
  current = $state.raw<HTMLElement | undefined>()
  /** Buttons navigation didn't use (A/B with nothing highlighted, Y, Z, shifts, paddles). */
  readonly unhandled = new Emitter<ZwiftButton>()
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor() {
    devices.presses.on((button) => {
      if (!this.handle(button)) this.unhandled.emit(button)
    })
  }

  /** True when the press was used for navigation. */
  handle(button: ZwiftButton): boolean {
    const cur = this.current?.isConnected && visible(this.current) ? this.current : undefined
    if (!cur && this.current) this.clear()

    if (DIRECTIONS.has(button)) {
      const dir = button as Direction
      if (
        cur &&
        (dir === 'left' || dir === 'right') &&
        this.adjust(cur, dir === 'right' ? 1 : -1)
      ) {
        this.touch()
        return true
      }
      this.move(cur, dir)
      return true
    }
    if (button === 'a' && cur) {
      this.activate(cur)
      this.touch()
      return true
    }
    if (button === 'b') {
      if (scope() !== document) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        this.clear()
        return true
      }
      if (cur) {
        this.clear()
        return true
      }
    }
    return false
  }

  clear(): void {
    this.current?.classList.remove(CLASS)
    this.current = undefined
    clearTimeout(this.timer)
  }

  private set(el: HTMLElement): void {
    this.current?.classList.remove(CLASS)
    el.classList.add(CLASS)
    this.current = el
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    this.touch()
  }

  /** Restarts the fade-out (Ride screen only: elsewhere the highlight stays). */
  private touch(): void {
    clearTimeout(this.timer)
    if (nav.screen === 'ride') this.timer = setTimeout(() => this.clear(), RIDE_IDLE_MS)
  }

  private move(cur: HTMLElement | undefined, dir: Direction): void {
    const list = candidates()
    if (!list.length) return
    if (!cur) {
      // Start on the screen's main action (the primary button), else the first item in view.
      const main = list.find((el) => el.classList.contains('primary') && el.closest('main'))
      this.set(main ?? list.find((el) => el.closest('main')) ?? list[0]!)
      return
    }
    // Up/down stay in the sidebar or the screen; only left/right cross between them.
    const region = (el: Element): Element | null => el.closest('nav, main, [role="dialog"]')
    const here = region(cur)
    const pool = dir === 'up' || dir === 'down' ? list.filter((el) => region(el) === here) : list
    const rects = pool
      .map((el, i) => ({ rect: el.getBoundingClientRect(), i }))
      .filter((r) => pool[r.i] !== cur)
    const i = nearest(cur.getBoundingClientRect(), dir, rects)
    if (i !== undefined) this.set(pool[i]!)
  }

  private activate(el: HTMLElement): void {
    if (el instanceof HTMLSelectElement) {
      this.adjust(el, 1, true)
    } else if (
      el instanceof HTMLInputElement &&
      /^(text|search|number|email|url|password)$/.test(el.type)
    ) {
      el.focus()
    } else {
      el.click()
    }
  }

  /** Left/right on a select or slider changes its value; true when it did. */
  private adjust(el: HTMLElement, step: 1 | -1, wrap = false): boolean {
    if (el instanceof HTMLSelectElement) {
      const n = el.options.length
      if (!n) return false
      let i = el.selectedIndex + step
      if (wrap) i = (i + n) % n
      if (i < 0 || i >= n) return true
      el.selectedIndex = i
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }
    if (el instanceof HTMLInputElement && el.type === 'range') {
      if (step > 0) el.stepUp()
      else el.stepDown()
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }
    return false
  }
}

export const padnav = new PadNav()
