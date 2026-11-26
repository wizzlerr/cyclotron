// How close the rider is to a target (E4-10): the Ride screen tints a tile green when on target,
// amber when near and red when off. Power counts in percent of the target (at least a few watts),
// cadence in rpm.

import type { MetricId } from './layout'

export type TargetFit = 'on' | 'near' | 'off'
export type TargetKind = 'power' | 'cadence'

/** Off by at most this much is "on" / "near" (power: fraction of the target, at least `minW`). */
export const TARGET_BANDS = {
  power: { on: 0.05, near: 0.1, onMinW: 5, nearMinW: 10 },
  cadence: { on: 5, near: 10 },
} as const

/** How close `actual` is to `target`; undefined when there is no target or no reading. */
export function targetFit(
  kind: TargetKind,
  actual: number | undefined,
  target: number | undefined,
): TargetFit | undefined {
  if (actual === undefined || target === undefined) return undefined
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) return undefined
  const off = Math.abs(actual - target)
  let on: number
  let near: number
  if (kind === 'power') {
    const b = TARGET_BANDS.power
    on = Math.max(b.onMinW, target * b.on)
    near = Math.max(b.nearMinW, target * b.near)
  } else {
    on = TARGET_BANDS.cadence.on
    near = TARGET_BANDS.cadence.near
  }
  return off <= on ? 'on' : off <= near ? 'near' : 'off'
}

const POWER: readonly MetricId[] = ['power3s', 'power', 'power10s']

/**
 * Which reading and target a tile compares, from its first power or cadence number: a power
 * number (or the target) against the target power, cadence (or its target) against the step's
 * cadence. A tile with only a target compares the 3 s power / cadence.
 */
export function tileTarget(
  metrics: readonly MetricId[],
): { kind: TargetKind; actual: MetricId; target: MetricId } | undefined {
  for (const m of metrics) {
    if (m === 'cadence' || m === 'cadenceTarget')
      return { kind: 'cadence', actual: 'cadence', target: 'cadenceTarget' }
    if (m === 'target' || POWER.includes(m)) {
      const actual = metrics.find((x) => POWER.includes(x)) ?? 'power3s'
      return { kind: 'power', actual, target: 'target' }
    }
  }
  return undefined
}
