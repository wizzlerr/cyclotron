<script lang="ts">
  import { caloriesKcal, heartRateZone, powerZone, type Segment } from '@cyclotron/core'
  import LiveChart from '../components/LiveChart.svelte'
  import RideSummary from '../components/RideSummary.svelte'
  import Tile from '../components/Tile.svelte'
  import WorkoutProfile from '../components/WorkoutProfile.svelte'
  import { devices } from '../devices/devices.svelte'
  import { formatDuration, formatPct } from '../lib/format'
  import { go } from '../nav.svelte'
  import { profile } from '../profile.svelte'
  import { ride } from '../ride/session.svelte'
  import { rideTiles, type TileId } from '../ride/tiles.svelte'

  const STEP_W = 10
  let ergWatts = $state(150)
  let confirmEnd = $state(false)

  const s = $derived(ride.state)
  const remaining = $derived(s ? Math.ceil(s.segmentRemainingS) : 0)
  const inFreeStep = $derived(s?.status === 'running' && s.segment?.kind === 'freeride')
  const pZone = $derived(
    devices.power3s && devices.power3s > 0 ? powerZone(devices.power3s, profile.ftpW) : undefined,
  )
  const hrZone = $derived(
    devices.bpm && profile.maxHr ? heartRateZone(devices.bpm, profile.maxHr) : undefined,
  )
  // Manual ERG: before a ride it drives the trainer directly; during a free-ride step it goes
  // through the session so it's recorded and survives pause/resume.
  const manualErgOn = $derived(
    ride.active ? ride.manual?.kind === 'erg' : devices.control.kind === 'erg',
  )

  function setErg(watts: number): void {
    ergWatts = Math.min(1000, Math.max(50, watts))
    const control = { kind: 'erg', watts: ergWatts } as const
    if (ride.active) ride.setManual(control)
    else void devices.setControl(control)
  }

  function ergOff(): void {
    if (ride.active) ride.setManual(undefined)
    else void devices.setControl({ kind: 'free' })
  }

  function end(): void {
    confirmEnd = false
    ride.end()
  }

  interface TileProps {
    label: string
    value: number | string | undefined
    unit?: string
    accent?: string
    highlight?: boolean
  }

  const fixed = (n: number | undefined, digits: number): string | undefined =>
    n === undefined ? undefined : n.toFixed(digits)

  /** Props for every tile (E4-1…E4-3); the layout setting picks which are shown (E4-5). */
  const tiles = $derived.by((): Record<TileId, TileProps> => {
    const m = ride.metrics
    const target = ride.active ? ride.targetW : manualErgOn ? ergWatts : undefined
    return {
      power3s: {
        label: pZone ? `Power · Z${pZone}` : 'Power',
        value: devices.power3s,
        unit: 'W',
        accent: pZone ? `var(--z${pZone})` : undefined,
      },
      power: { label: 'Power (instant)', value: devices.data?.powerW, unit: 'W' },
      power10s: { label: 'Power 10 s', value: devices.power10s, unit: 'W' },
      target: { label: 'Target', value: target, unit: 'W' },
      intervalLeft: {
        label: 'Interval left',
        value: s ? formatDuration(remaining) : undefined,
        highlight: s?.status === 'running' && remaining <= 5 && s.next !== undefined,
      },
      intervalAvg: { label: 'Interval avg', value: ride.intervalAvgW, unit: 'W' },
      elapsed: {
        label: 'Elapsed',
        value: s ? formatDuration(s.positionS) : undefined,
        unit: s && !ride.isFreeRide ? `/ ${formatDuration(s.totalS)}` : '',
      },
      hr: {
        label: hrZone ? `HR · Z${hrZone}` : 'Heart rate',
        value: devices.bpm,
        unit: 'bpm',
        accent: hrZone ? `var(--z${hrZone})` : undefined,
      },
      cadence: { label: 'Cadence', value: devices.data?.cadenceRpm, unit: 'rpm' },
      speed: { label: 'Speed', value: devices.data?.speedKmh, unit: 'km/h' },
      wkg: {
        label: profile.weightKg ? 'W/kg' : 'W/kg (set weight)',
        value: profile.weightKg ? fixed((devices.power3s ?? 0) / profile.weightKg, 1) : undefined,
      },
      avgPower: { label: 'Avg power', value: m?.avgPowerW, unit: 'W' },
      np: { label: 'NP', value: m?.normalizedPowerW, unit: 'W' },
      if: { label: 'IF', value: fixed(m?.intensity, 2) },
      tss: { label: 'TSS', value: m?.tss },
      kcal: { label: 'Calories', value: m && caloriesKcal(m.workKj), unit: 'kcal' },
    }
  })

  const RIDE_METRICS = new Set<TileId>([
    'avgPower',
    'np',
    'if',
    'tss',
    'kcal',
    'elapsed',
    'intervalAvg',
  ])
  /** Before a ride: only live readings; ride totals and interval tiles have nothing to show. */
  const shownIds = $derived(
    rideTiles.shown.filter((id) => {
      if (!ride.workout) return !RIDE_METRICS.has(id) && id !== 'intervalLeft'
      return !(ride.isFreeRide && (id === 'intervalLeft' || id === 'intervalAvg'))
    }),
  )

  function describe(seg: Segment | undefined): string {
    if (!seg) return ''
    const rep = seg.repeat ? ` · ${seg.repeat.index}/${seg.repeat.count}` : ''
    const cad = seg.cadence ? ` · ${seg.cadence} rpm` : ''
    switch (seg.kind) {
      case 'steady':
        return `Steady ${formatPct(seg.toPct)}${cad}${rep}`
      case 'ramp':
        return `Ramp ${formatPct(seg.fromPct)} → ${formatPct(seg.toPct)}${cad}${rep}`
      case 'freeride':
        return `Free ride${rep}`
      case 'maxeffort':
        return seg.effort ? 'Test effort: as hard as you can hold evenly' : `Max effort${rep}`
    }
  }
</script>

{#snippet ergControls()}
  {#if manualErgOn}
    <button onclick={() => setErg(ergWatts - STEP_W)}>−{STEP_W} W</button>
    <span class="erg">ERG {ergWatts} W</span>
    <button onclick={() => setErg(ergWatts + STEP_W)}>+{STEP_W} W</button>
    <button onclick={ergOff}>ERG off</button>
  {:else}
    <button onclick={() => setErg(ergWatts)}>ERG mode</button>
  {/if}
{/snippet}

{#snippet tileGrid()}
  <div class="tiles">
    {#each shownIds as id (id)}
      <Tile {...tiles[id]} />
    {/each}
  </div>
{/snippet}

{#snippet deviceWarnings()}
  {#if !devices.trainer}
    <p class="warn">
      No trainer connected. <button onclick={() => go('settings')}>Devices…</button>
    </p>
  {:else if devices.trainerStatus === 'reconnecting'}
    <p class="warn">
      Trainer connection lost, reconnecting… The target is re-applied when it's back.
    </p>
  {/if}
{/snippet}

{#if ride.workout && ride.player && s}
  <div class="head">
    <h1>{ride.workout.name}</h1>
    {#if !ride.isFreeRide}<span class="muted">{describe(s.segment)}</span>{/if}
  </div>

  {#if s.status === 'finished'}
    {#if ride.saving}
      <p class="muted">Saving the ride…</p>
    {:else if ride.result}
      <RideSummary
        result={ride.result}
        onclose={() => ride.close()}
        ondiscard={() => ride.discard()}
      />
    {:else}
      <p class="muted">Nothing was recorded.</p>
      <button onclick={() => ride.close()}>Close</button>
    {/if}
  {:else}
    {@render deviceWarnings()}

    {@render tileGrid()}

    <section class="controls">
      {#if s.status === 'ready'}
        <button class="primary" onclick={() => ride.start()} disabled={!devices.trainer}>
          Start
        </button>
        <button onclick={() => ride.close()}>Close</button>
      {:else}
        {#if s.status === 'running'}
          <button onclick={() => ride.pause()}>Pause</button>
        {:else}
          <button class="primary" onclick={() => ride.resume()}>Resume</button>
        {/if}
        {#if !ride.isFreeRide}<button onclick={() => ride.skip()}>Skip step</button>{/if}
        {#if confirmEnd}
          <span class="warn">End and save the ride?</span>
          <button class="primary" onclick={end}>End</button>
          <button onclick={() => (confirmEnd = false)}>Cancel</button>
        {:else}
          <button onclick={() => (confirmEnd = true)}>End…</button>
        {/if}

        {#if !ride.isFreeRide}
          <span class="sep"></span>
          <button onclick={() => ride.adjustIntensity(-0.05)}>−5</button>
          <button onclick={() => ride.adjustIntensity(-0.01)}>−1</button>
          <button class="intensity" onclick={() => ride.resetIntensity()} title="Reset to 100 %">
            {formatPct(s.intensity)}
          </button>
          <button onclick={() => ride.adjustIntensity(0.01)}>+1</button>
          <button onclick={() => ride.adjustIntensity(0.05)}>+5</button>
        {/if}
      {/if}
      <label class="mute"><input type="checkbox" bind:checked={ride.muted} /> Mute</label>
    </section>

    {#if inFreeStep}
      <section class="controls">{@render ergControls()}</section>
    {/if}

    {#if !ride.isFreeRide}
      <div class="profile card">
        <WorkoutProfile timeline={ride.player.timeline} positionS={s.positionS} height={100} />
        {#if s.next}
          <p class="muted next">
            Next in {formatDuration(remaining)}: {describe(s.next)}{s.nextTargetW
              ? ` · ${s.nextTargetW} W`
              : ''}
          </p>
        {/if}
      </div>
    {/if}

    {#if s.status !== 'ready'}
      <div class="card chart"><LiveChart height={170} /></div>
    {/if}
  {/if}

  {#if ride.notice && s.status !== 'finished'}<p class="warn">{ride.notice}</p>{/if}
  {#if ride.error}<p class="error">{ride.error}</p>{/if}
  {#if devices.error}<p class="error">{devices.error}</p>{/if}
{:else}
  <h1>Ride</h1>

  {#if !devices.trainer}
    <p class="muted">No trainer connected.</p>
    <button onclick={() => go('settings')}>Devices…</button>
  {:else}
    {@render deviceWarnings()}
    {@render tileGrid()}

    <section class="controls">
      <button class="primary" onclick={() => ride.startFreeRide()}>Start free ride</button>
      <button onclick={() => go('workouts')}>Choose a workout…</button>
      <span class="sep"></span>
      {@render ergControls()}
    </section>
    <p class="muted">Nothing is recorded until you start a ride.</p>
    {#if devices.error}<p class="error">{devices.error}</p>{/if}
  {/if}
{/if}

<style>
  .head {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .head h1 {
    margin: 0;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
    gap: 0.75rem;
  }
  .chart {
    margin-top: 0.75rem;
    max-width: none;
  }
  .profile {
    margin-top: 0.75rem;
    max-width: none;
  }
  .next {
    margin: 0.5rem 0 0;
  }
  .controls {
    margin-top: 1rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .sep {
    width: 1rem;
  }
  .intensity {
    min-width: 4.5rem;
    font-weight: 600;
  }
  .primary {
    font-weight: 600;
  }
  .mute {
    margin-left: auto;
    color: var(--muted);
  }
  .warn {
    color: var(--warn);
  }
  .error {
    color: var(--error);
  }
  .erg {
    min-width: 7rem;
    text-align: center;
    font-weight: 600;
  }
</style>
