// Layout helpers that make a screen fit the window instead of scrolling (Ride screen).

export interface Elastic {
  /** Share of the free space this part gets, relative to the others. */
  weight: number
  min: number
  max?: number
}

/**
 * Splits `space` px between the parts by weight, keeping each within its min/max: what a part
 * can't take (it hit its max) goes to the others. When even the minimums don't fit, every part
 * gets its minimum and the page scrolls.
 */
export function shareSpace(space: number, parts: Elastic[]): number[] {
  const items = parts.map((p) => ({ ...p, size: p.min }))
  let left = space - items.reduce((a, p) => a + p.min, 0)
  let open = items
  while (left > 0.5 && open.length > 0) {
    const weights = open.reduce((a, p) => a + p.weight, 0)
    const stillOpen = open.filter((p) => {
      const want = (left * p.weight) / weights
      const take = Math.min(want, (p.max ?? Infinity) - p.size)
      p.size += take
      return take >= want
    })
    left = space - items.reduce((a, p) => a + p.size, 0)
    if (stillOpen.length === open.length) break
    open = stillOpen
  }
  return items.map((p) => Math.floor(p.size))
}
