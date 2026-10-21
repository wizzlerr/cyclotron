<script lang="ts">
  // E4-4: power, target, heart rate and cadence over the ride (uPlot, DESIGN.md D13).
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'
  import { formatDuration } from '../lib/format'
  import { ride } from '../ride/session.svelte'

  let { height = 220 }: { height?: number } = $props()

  let el: HTMLDivElement
  let plot: uPlot | undefined

  $effect(() => {
    const css = getComputedStyle(document.documentElement)
    const color = (name: string): string => css.getPropertyValue(name).trim()
    const grid = { stroke: '#262d36', width: 1 }
    const axis = { stroke: color('--muted'), grid, ticks: grid }
    // Lines read better than dots at 1 Hz.
    const line = { points: { show: false } }

    const p = new uPlot(
      {
        width: el.clientWidth,
        height,
        cursor: { drag: { x: false, y: false } },
        scales: {
          x: { time: false },
          W: { range: (_u, _min, max) => [0, Math.max(100, max * 1.1)] },
        },
        axes: [
          {
            ...axis,
            label: 'Time',
            // Whole seconds and round minutes, so early in a ride labels don't repeat (0:01 0:01 …).
            incrs: [1, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600],
            values: (_u, splits) => splits.map((s) => formatDuration(s)),
          },
          { ...axis, scale: 'W', label: 'Power (W)', size: 50 },
          {
            ...axis,
            scale: 'bpm',
            side: 1,
            label: 'HR (bpm) · rpm',
            size: 50,
            grid: { show: false },
          },
        ],
        series: [
          { label: 'Time', value: (_u, v) => (v == null ? '–' : formatDuration(v)) },
          {
            ...line,
            label: 'Power',
            scale: 'W',
            stroke: color('--z2'),
            width: 1.5,
            value: unit('W'),
          },
          {
            ...line,
            label: 'Target',
            scale: 'W',
            stroke: color('--warn'),
            width: 1.5,
            dash: [6, 4],
            paths: uPlot.paths.stepped?.({ align: 1 }),
            value: unit('W'),
          },
          {
            ...line,
            label: 'Heart rate',
            scale: 'bpm',
            stroke: color('--error'),
            width: 1.5,
            value: unit('bpm'),
          },
          {
            ...line,
            label: 'Cadence',
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
    const resize = new ResizeObserver(() => p.setSize({ width: el.clientWidth, height }))
    resize.observe(el)
    return () => {
      resize.disconnect()
      p.destroy()
      plot = undefined
    }
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
