<script lang="ts">
  // E4-4: power, target, heart rate and cadence over the ride (uPlot, DESIGN.md D13).
  import { untrack } from 'svelte'
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'
  import { formatNumber } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { formatDuration } from '../lib/format'
  import { ride, type ChartData } from '../ride/session.svelte'

  let {
    height = 220,
    data = undefined,
    version = undefined,
    axes = true,
    titles = true,
    legend = true,
    textScale = 1,
    textColor = undefined,
  }: {
    height?: number
    /** Series to show instead of the ride's (the tile editor's preview); `version` changes with it. */
    data?: ChartData
    version?: number
    /** Parts and texts the rider can turn off or restyle (Ride screen layout). */
    axes?: boolean
    titles?: boolean
    legend?: boolean
    textScale?: number
    textColor?: string
  } = $props()

  let el: HTMLDivElement
  let plot: uPlot | undefined

  $effect(() => {
    const css = getComputedStyle(document.documentElement)
    const color = (name: string): string => css.getPropertyValue(name).trim()
    const localeTicks = (_u: uPlot, splits: number[]): string[] =>
      splits.map((v) => (v == null ? '' : formatNumber(v)))
    const grid = { stroke: '#262d36', width: 1 }
    const family = getComputedStyle(el).fontFamily || 'system-ui'
    const px = (n: number): string => `${Math.round(n * textScale)}px ${family}`
    const axis = {
      show: axes,
      stroke: textColor ?? color('--muted'),
      grid,
      ticks: grid,
      font: px(12),
      labelFont: px(12),
      labelSize: titles ? Math.round(24 * textScale) : 0,
      size: Math.round(50 * textScale),
    }
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
        legend: { show: legend },
        scales: {
          x: { time: false },
          W: { range: (_u, _min, max) => [0, Math.max(100, max * 1.1)] },
        },
        axes: [
          {
            ...axis,
            label: titles ? L.time : undefined,
            // Whole seconds and round minutes, so early in a ride labels don't repeat (0:01 0:01 …).
            incrs: [1, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600],
            values: (_u, splits) => splits.map((s) => formatDuration(s)),
          },
          {
            ...axis,
            scale: 'W',
            label: titles ? L.powerAxis : undefined,
            values: localeTicks,
          },
          {
            ...axis,
            scale: 'bpm',
            side: 1,
            label: titles ? L.hrAxis : undefined,
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
      untrack(() => data ?? ride.chart),
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
    void (version ?? ride.chartVersion)
    plot?.setData(data ?? ride.chart)
  })

  function unit(u: string) {
    return (_u: uPlot, v: number | null): string => (v == null ? '–' : `${Math.round(v)} ${u}`)
  }
</script>

<div class="chart" bind:this={el} style:--ts={textScale} style:--tc={textColor}></div>

<style>
  .chart {
    width: 100%;
    min-width: 0;
  }
  .chart :global(.u-legend) {
    color: var(--tc, var(--fg));
    font-size: calc(0.85rem * var(--ts, 1));
  }
</style>
