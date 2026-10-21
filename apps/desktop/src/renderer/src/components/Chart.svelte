<script lang="ts">
  // A uPlot chart that fills its container's width (E9). Rebuilt when `options` changes, updated in
  // place when only `data` does.
  import { untrack } from 'svelte'
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'

  let {
    options,
    data,
    height = 220,
  }: {
    options: Omit<uPlot.Options, 'width' | 'height'>
    data: uPlot.AlignedData
    height?: number
  } = $props()

  let el: HTMLDivElement
  let plot: uPlot | undefined

  $effect(() => {
    const opts = options
    const p = new uPlot(
      { ...opts, width: el.clientWidth, height: untrack(() => height) },
      untrack(() => data),
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
    const d = data
    plot?.setData(d)
  })

  $effect(() => {
    const h = height
    if (el) plot?.setSize({ width: el.clientWidth, height: h })
  })
</script>

<div class="chart" bind:this={el}></div>

<style>
  .chart {
    width: 100%;
    min-width: 0;
  }
</style>
