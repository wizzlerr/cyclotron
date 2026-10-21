// Shared uPlot styling (E9). One y-axis per chart; thin lines; quiet solid grid (dataviz rules).
import type uPlot from 'uplot'

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Validated chart series colours for the dark panel (series-1…3 in app.css). */
export const series = (n: 1 | 2 | 3): string => cssVar(`--series-${n}`)

export function axis(extra: Partial<uPlot.Axis> = {}): uPlot.Axis {
  const grid = { stroke: cssVar('--grid'), width: 1 }
  return { stroke: cssVar('--muted'), grid, ticks: grid, ...extra }
}

/** A line series: 2 px, no dots (1 Hz data reads better as a line). */
export function line(
  label: string,
  stroke: string,
  extra: Partial<uPlot.Series> = {},
): uPlot.Series {
  return { label, stroke, width: 2, points: { show: false }, ...extra }
}

const DURATION_TICKS = [1, 5, 15, 60, 300, 1200, 3600]

/** Log-scale duration axis for power curves, with a few round ticks (uPlot's own log ticks are
 * every mantissa step, far too many to label). */
export function durationAxis(label: (s: number) => string): uPlot.Axis {
  return axis({
    label: 'Duration',
    splits: (u) => {
      const { min = 1, max = 3600 } = u.scales['x'] ?? {}
      return DURATION_TICKS.filter((t) => t >= min && t <= max)
    },
    // uPlot passes null for ticks it hides to avoid overlap.
    values: (_u, splits) => splits.map((s) => (s == null ? '' : label(s))),
  })
}
