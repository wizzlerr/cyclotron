<script lang="ts">
  // E4-4: power, target, heart rate and cadence over the ride (uPlot, DESIGN.md D13).
  import { untrack } from 'svelte'
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'
  import { formatNumber } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { formatDuration } from '../lib/format'
  import { ride } from '../ride/session.svelte'

  let { height = 220 }: { height?: number } = $props()

  let el: HTMLDivElement
  let plot: uPlot | undefined

  $effect(() => {
    const css = getComputedStyle(document.documentElement)
    const color = (name: string): string => css.getPropertyValue(name).trim()
    const localeTicks = (_u: uPlot, splits: number[]): string[] =>
      splits.map((v) => (v == null ? '' : formatNumber(v)))
    const grid = { stroke: '#262d36', width: 1 }
    const axis = { stroke: color('--muted'), grid, ticks: grid }
    // Lines read better than dots at 1 Hz.
    const line = { points: { show: false } }
    // Reading t() here rebuilds the chart when the language changes.
    const L = t().ride.chart

    const p = new uPlot(
      {
        width: el.clientWidth,
        // Created once; height changes resize it below instead of rebuilding.
        height: untrack(() => height),
        cursor: { drag: { x: false, y: false } },
        scales: {
          x: { time: false },
          W: { range: (_u, _min, max) => [0, Math.max(100, max * 1.1)] },
        },
        axes: [
          {
            ...axis,
            label: L.time,
            // Whole seconds and round minutes, so early in a ride labels don't repeat (0:01 0:01 …).
            incrs: [1, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600],
            values: (_u, splits) => splits.map((s) => formatDuration(s)),
          },
          { ...axis, scale: 'W', label: L.powerAxis, size: 50, values: localeTicks },
          {
            ...axis,
            scale: 'bpm',
            side: 1,
            label: L.hrAxis,
            size: 50,
            values: localeTicks,
            grid: { show: false },
          },
        ],
        series: [
          { label: L.time, value: (_u, v) => (v == null ? '–' : formatDuration(v)) },
          {
            ...line,
            label: L.power,
            scale: 'W',
            stroke: color('--z2'),
            width: 1.5,
            value: unit('W'),
          },
          {
            ...line,
            label: L.target,
            scale: 'W',
            stroke: color('--warn'),
            width: 1.5,
            dash: [6, 4],
            paths: uPlot.paths.stepped?.({ align: 1 }),
            value: unit('W'),
          },
          {
            ...line,
            label: L.heartRate,
            scale: 'bpm',
            stroke: color('--error'),
            width: 1.5,
            value: unit('bpm'),
          },
          {
            ...line,
            label: L.cadence,
            scale: 'bpm',
            stroke: color('--muted'),
            width: 1,
            show: false,
            value: unit('rpm'),
          },
        ],
      },
      ride.chart,
      el,
    )
    plot = p
    const resize = new ResizeObserver(() =>
      p.setSize({ width: el.clientWidth, height: untrack(() => height) }),
    )
    resize.observe(el)
    return () => {
      resize.disconnect()
      p.destroy()
      plot = undefined
    }
  })

  $effect(() => {
    const h = height
    if (el) plot?.setSize({ width: el.clientWidth, height: h })
  })

  $effect(() => {
    void ride.chartVersion
    plot?.setData(ride.chart)
  })

  function unit(u: string) {
    return (_u: uPlot, v: number | null): string => (v == null ? '–' : `${Math.round(v)} ${u}`)
  }
</script>

<div class="chart" bind:this={el}></div>

<style>
  .chart {
    width: 100%;
    min-width: 0;
  }
  .chart :global(.u-legend) {
    color: var(--fg);
    font-size: 0.85rem;
  }
</style>
