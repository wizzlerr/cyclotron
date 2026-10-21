<script lang="ts">
  // E3-5: workout profile, one block per segment coloured by power zone, with the current position.
  // Hovering a block shows the step and its watts; `axes` adds power and time axes.
  import { hasTarget, powerZone, type Segment } from '@cyclotron/core'
  import { describeSegment, formatDuration } from '../lib/format'

  let {
    timeline,
    positionS = undefined,
    height = 120,
    ftpW = undefined,
    axes = false,
  }: {
    timeline: readonly Segment[]
    positionS?: number
    height?: number
    /** Watts for 100 % (FTP × intensity). Without it, targets are shown as % FTP. */
    ftpW?: number
    axes?: boolean
  } = $props()

  const W = 1000
  // Steps without a target are drawn as a grey block at this height.
  const NO_TARGET_PCT = 0.5

  const totalS = $derived(timeline.reduce((t, s) => Math.max(t, s.startS + s.durationS), 0))
  const maxPct = $derived(
    Math.max(1.2, ...timeline.map((s) => Math.max(s.fromPct, s.toPct))) * 1.05,
  )

  const x = (s: number): number => (totalS > 0 ? (s / totalS) * W : 0)
  const y = (pct: number): number => height - (pct / maxPct) * height

  const blocks = $derived(
    timeline.map((s) => {
      const target = hasTarget(s)
      const from = target ? s.fromPct : NO_TARGET_PCT
      const to = target ? s.toPct : NO_TARGET_PCT
      const x0 = x(s.startS)
      const x1 = x(s.startS + s.durationS)
      return {
        points: `${x0},${height} ${x0},${y(from)} ${x1},${y(to)} ${x1},${height}`,
        fill: target ? `var(--z${powerZone((from + to) / 2, 1)})` : 'var(--z-none)',
      }
    }),
  )
  const ftpY = $derived(y(1))

  const watts = (pct: number): number => Math.round(pct * (ftpW ?? 0))

  /** Round steps that give about 4 ticks. */
  function niceStep(range: number, steps: readonly number[]): number {
    return steps.find((s) => range / s <= 5) ?? steps.at(-1)!
  }

  // Y ticks in watts when the FTP is known, else in % FTP; positions as fractions of FTP.
  const yTicks = $derived.by(() => {
    if (ftpW) {
      const step = niceStep(maxPct * ftpW, [25, 50, 100, 200, 250, 500])
      const ticks = []
      for (let w = step; w < maxPct * ftpW; w += step) ticks.push({ pct: w / ftpW, label: `${w}` })
      return ticks
    }
    const ticks = []
    for (let p = 0.5; p < maxPct; p += 0.5) ticks.push({ pct: p, label: `${p * 100}` })
    return ticks
  })
  const xTicks = $derived.by(() => {
    const step = niceStep(totalS, [60, 120, 300, 600, 900, 1200, 1800, 3600])
    const ticks = []
    for (let t = 0; t <= totalS; t += step) ticks.push(t)
    return ticks
  })

  let hovered = $state<number | undefined>()
  let hoverX = $state(0)
  let plotWidth = $state(0)

  function onMove(e: PointerEvent): void {
    const rect = (e.currentTarget as Element).getBoundingClientRect()
    hoverX = e.clientX - rect.left
    const t = (hoverX / rect.width) * totalS
    const i = timeline.findIndex((s) => t >= s.startS && t < s.startS + s.durationS)
    hovered = i >= 0 ? i : undefined
  }

  const tip = $derived.by(() => {
    const seg = hovered === undefined ? undefined : timeline[hovered]
    if (!seg) return undefined
    let target = ''
    if (hasTarget(seg) && ftpW) {
      const [a, b] = [watts(seg.fromPct), watts(seg.toPct)]
      target = a === b ? `${b} W` : `${a} → ${b} W`
    }
    return {
      title: describeSegment(seg),
      target,
      when: `${formatDuration(seg.durationS)} · at ${formatDuration(seg.startS)}`,
    }
  })
</script>

<div class="profile" class:axes>
  {#if axes}
    <span class="axis-title y-title">{ftpW ? 'Power (W)' : '% FTP'}</span>
    <div class="y-ticks" style:height="{height}px">
      {#each yTicks as t (t.pct)}
        <span style:top="{(y(t.pct) / height) * 100}%">{t.label}</span>
      {/each}
    </div>
  {/if}

  <div
    class="plot"
    role="presentation"
    bind:clientWidth={plotWidth}
    onpointermove={onMove}
    onpointerleave={() => (hovered = undefined)}
  >
    <svg
      viewBox="0 0 {W} {height}"
      preserveAspectRatio="none"
      style:height="{height}px"
      role="img"
      aria-label="Workout profile"
    >
      {#if axes}
        {#each yTicks as t (t.pct)}
          <line class="grid" x1="0" x2={W} y1={y(t.pct)} y2={y(t.pct)} />
        {/each}
      {/if}
      {#each blocks as b, i (i)}
        <polygon points={b.points} fill={b.fill} class:hovered={hovered === i} />
      {/each}
      <line class="ftp" x1="0" x2={W} y1={ftpY} y2={ftpY} />
      {#if positionS !== undefined && totalS > 0}
        <rect class="done" x="0" y="0" width={x(positionS)} {height} />
        <line class="now" x1={x(positionS)} x2={x(positionS)} y1="0" y2={height} />
      {/if}
    </svg>
    {#if axes}
      <span class="ftp-label" style:top="{(ftpY / height) * 100}%">FTP</span>
    {/if}
    {#if tip}
      <div class="tip" class:left={hoverX > plotWidth / 2} style:left="{hoverX}px">
        <strong>{tip.title}</strong>
        {#if tip.target}<span class="target">{tip.target}</span>{/if}
        <span class="muted">{tip.when}</span>
      </div>
    {/if}
  </div>

  {#if axes}
    <div class="x-ticks">
      {#each xTicks as t (t)}
        <span style:left="{(t / totalS) * 100}%">{formatDuration(t)}</span>
      {/each}
    </div>
    <span class="axis-title x-title">Time</span>
  {/if}
</div>

<style>
  .profile {
    position: relative;
  }
  .profile.axes {
    display: grid;
    grid-template-columns: 1rem 2.5rem 1fr;
    grid-template-rows: auto 1.25rem auto;
    column-gap: 0.25rem;
  }
  .plot {
    position: relative;
    grid-column: 3;
    grid-row: 1;
  }
  svg {
    display: block;
    width: 100%;
  }
  polygon {
    stroke: var(--bg);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  polygon.hovered {
    filter: brightness(1.3);
  }
  .grid {
    stroke: var(--z-none);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    opacity: 0.5;
  }
  .ftp {
    stroke: var(--muted);
    stroke-dasharray: 4 4;
    vector-effect: non-scaling-stroke;
    opacity: 0.6;
  }
  .done {
    fill: var(--bg);
    opacity: 0.55;
    pointer-events: none;
  }
  .now {
    stroke: var(--fg);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }
  .axis-title {
    color: var(--muted);
    font-size: 0.75rem;
  }
  .y-title {
    grid-column: 1;
    grid-row: 1;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    text-align: center;
    align-self: center;
  }
  .y-ticks {
    grid-column: 2;
    grid-row: 1;
    position: relative;
  }
  .y-ticks span {
    position: absolute;
    right: 0;
    transform: translateY(-50%);
    font-size: 0.7rem;
    color: var(--muted);
  }
  .x-ticks {
    grid-column: 3;
    grid-row: 2;
    position: relative;
  }
  .x-ticks span {
    position: absolute;
    top: 0.1rem;
    transform: translateX(-50%);
    font-size: 0.7rem;
    color: var(--muted);
    white-space: nowrap;
  }
  .x-ticks span:first-child {
    transform: none;
  }
  .x-title {
    grid-column: 3;
    grid-row: 3;
    text-align: center;
  }
  .ftp-label {
    position: absolute;
    right: 0.25rem;
    transform: translateY(-110%);
    font-size: 0.65rem;
    color: var(--muted);
    pointer-events: none;
  }
  .tip {
    position: absolute;
    top: 0.25rem;
    transform: translateX(0.5rem);
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.35rem 0.55rem;
    background: var(--panel);
    border: 1px solid var(--z-none);
    border-radius: 6px;
    font-size: 0.8rem;
    white-space: nowrap;
    pointer-events: none;
    z-index: 2;
  }
  .tip.left {
    transform: translateX(calc(-100% - 0.5rem));
  }
  .target {
    font-size: 1rem;
    font-weight: 600;
  }
</style>
