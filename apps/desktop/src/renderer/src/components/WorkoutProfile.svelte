<script lang="ts">
  // E3-5: workout profile, one block per segment coloured by power zone, with the current position.
  import { powerZone, type Segment } from '@cyclotron/core'

  let {
    timeline,
    positionS = undefined,
    height = 120,
  }: { timeline: readonly Segment[]; positionS?: number; height?: number } = $props()

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
      const target = s.kind === 'steady' || s.kind === 'ramp'
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
</script>

<svg
  viewBox="0 0 {W} {height}"
  preserveAspectRatio="none"
  style:height="{height}px"
  role="img"
  aria-label="Workout profile"
>
  {#each blocks as b, i (i)}
    <polygon points={b.points} fill={b.fill} />
  {/each}
  <line class="ftp" x1="0" x2={W} y1={ftpY} y2={ftpY} />
  {#if positionS !== undefined && totalS > 0}
    <rect class="done" x="0" y="0" width={x(positionS)} {height} />
    <line class="now" x1={x(positionS)} x2={x(positionS)} y1="0" y2={height} />
  {/if}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
  }
  polygon {
    stroke: var(--bg);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
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
  }
  .now {
    stroke: var(--fg);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
</style>
