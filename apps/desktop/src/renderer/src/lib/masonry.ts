// Masonry for card pages (Home, Settings): cards pack into the space under shorter neighbours
// instead of each row being as tall as its tallest card. The grid has tiny rows (`.cards` in
// app.css) and every card spans as many as its height needs; reading order stays left to right.
// (CSS `grid-template-rows: masonry` isn't available in Chromium yet.)

/** Must match `grid-auto-rows` of `.cards`. */
const ROW_PX = 4

export function masonry(node: HTMLElement): { destroy(): void } {
  let frame = 0
  const layout = (): void => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      // The gap between cards comes from the span, so read it from the columns.
      const gap = parseFloat(getComputedStyle(node).columnGap) || 16
      for (const el of Array.from(node.children) as HTMLElement[]) {
        // Cards are aligned to the start of their area, so this is their content height.
        const h = el.getBoundingClientRect().height
        el.style.gridRowEnd = `span ${Math.max(1, Math.ceil((h + gap) / ROW_PX))}`
      }
    })
  }

  const sizes = new ResizeObserver(layout)
  const watch = (): void => {
    sizes.disconnect()
    sizes.observe(node)
    for (const el of Array.from(node.children)) sizes.observe(el)
    layout()
  }
  // Cards appear and disappear (e.g. the unfinished-ride card on Home).
  const children = new MutationObserver(watch)
  children.observe(node, { childList: true })
  watch()

  return {
    destroy() {
      cancelAnimationFrame(frame)
      sizes.disconnect()
      children.disconnect()
    },
  }
}
