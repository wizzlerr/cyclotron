// Shared uPlot styling (E9). One y-axis per chart; thin lines; quiet solid grid (dataviz rules).
import type uPlot from 'uplot'
import { formatDate, formatNumber } from '../i18n/i18n.svelte'

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Validated chart series colours for the dark panel (series-1…3 in app.css). */
export const series = (n: 1 | 2 | 3): string => cssVar(`--series-${n}`)

/** An axis with numeric ticks in the UI's locale ("0,5" in Polish); pass `values` to override. */
export function axis(extra: Partial<uPlot.Axis> = {}): uPlot.Axis {
  const grid = { stroke: cssVar('--grid'), width: 1 }
  const values = (_u: uPlot, splits: number[]): string[] =>
    splits.map((s) => (s == null ? '' : formatNumber(s)))
  return { stroke: cssVar('--muted'), grid, ticks: grid, values, ...extra }
}

/** A line series: 2 px, no dots (1 Hz data reads better as a line). */
export function line(
  label: string,
  stroke: string,
  extra: Partial<uPlot.Series> = {},
): uPlot.Series {
  return { label, stroke, width: 2, points: { show: false }, ...extra }
}

/** Day ticks for a time-scaled x axis, in the UI's locale (uPlot's own are English). Over more
 * than about a year the ticks are months, so they show the year instead of the day. */
export function dateAxis(): uPlot.Axis {
  return axis({
    values: (u, splits) => {
      const { min = 0, max = 0 } = u.scales['x'] ?? {}
      const style: Intl.DateTimeFormatOptions =
        max - min > 330 * 86400
          ? { month: 'short', year: 'numeric' }
          : { day: 'numeric', month: 'short' }
      return splits.map((s) => (s == null ? '' : formatDate(s * 1000, style)))
    },
  })
}

const DURATION_TICKS = [1, 5, 15, 60, 300, 1200, 3600]

/** Log-scale duration axis for power curves, with a few round ticks (uPlot's own log ticks are
 * every mantissa step, far too many to label). */
export function durationAxis(label: (s: number) => string, title: string): uPlot.Axis {
  return axis({
    label: title,
    splits: (u) => {
      const { min = 1, max = 3600 } = u.scales['x'] ?? {}
      return DURATION_TICKS.filter((t) => t >= min && t <= max)
    },
    // uPlot's log-axis filter would hide all but 1, 10, 100…; these few ticks don't collide.
    filter: (_u, splits) => splits,
    values: (_u, splits) => splits.map((s) => (s == null ? '' : label(s))),
  })
}

/** x scale for a power curve: log, ending at the longest duration (uPlot would round it up to
 * the next power of 10, leaving the right part of the chart empty). */
export const durationScale: uPlot.Scale = {
  time: false,
  distr: 3,
  log: 10,
  range: (_u, min, max) => [min, max],
}
