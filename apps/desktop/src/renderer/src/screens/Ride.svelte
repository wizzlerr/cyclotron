<script lang="ts">
  import { powerZone, type Segment } from '@cyclotron/core'
  import Tile from '../components/Tile.svelte'
  import WorkoutProfile from '../components/WorkoutProfile.svelte'
  import { devices } from '../devices/devices.svelte'
  import { formatDuration, formatPct } from '../lib/format'
  import { go } from '../nav.svelte'
  import { profile } from '../profile.svelte'
  import { ride } from '../ride/session.svelte'

  const STEP_W = 10
  let ergWatts = $state(150)

  const ergOn = $derived(devices.control.kind === 'erg')
  const s = $derived(ride.state)
  const remaining = $derived(s ? Math.ceil(s.segmentRemainingS) : 0)
  const powerAccent = $derived(
    devices.data && devices.data.powerW > 0
      ? `var(--z${powerZone(devices.data.powerW, profile.ftpW)})`
      : undefined,
  )

  function setErg(watts: number): void {
    ergWatts = Math.min(1000, Math.max(50, watts))
    void devices.setControl({ kind: 'erg', watts: ergWatts })
  }

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
        return `Max effort${rep}`
    }
  }
</script>

{#if ride.workout && ride.player && s}
  <div class="head">
    <h1>{ride.workout.name}</h1>
    <span class="muted">{describe(s.segment)}</span>
  </div>

  {#if !devices.trainer}
    <p class="warn">
      No trainer connected. <button onclick={() => go('settings')}>Devices…</button>
    </p>
  {:else if devices.trainerStatus === 'reconnecting'}
    <p class="warn">
      Trainer connection lost, reconnecting… The target is re-applied when it's back.
    </p>
  {/if}

  <div class="tiles">
    <Tile label="Power" value={devices.data?.powerW} unit="W" accent={powerAccent} />
    <Tile label="Target" value={s.targetW} unit="W" />
    <Tile
      label="Interval left"
      value={s.status === 'finished' ? undefined : formatDuration(remaining)}
      highlight={s.status === 'running' && remaining <= 5 && s.next !== undefined}
    />
    <Tile label="Heart rate" value={devices.bpm} unit="bpm" />
    <Tile label="Cadence" value={devices.data?.cadenceRpm} unit="rpm" />
    <Tile label="Elapsed" value={formatDuration(s.positionS)} unit="/ {formatDuration(s.totalS)}" />
  </div>

  <div class="profile card">
    <WorkoutProfile timeline={ride.player.timeline} positionS={s.positionS} height={140} />
    {#if s.next}
      <p class="muted next">
        Next in {formatDuration(remaining)}: {describe(s.next)}{s.nextTargetW
          ? ` · ${s.nextTargetW} W`
          : ''}
      </p>
    {/if}
  </div>

  <section class="controls">
    {#if s.status === 'ready'}
      <button class="primary" onclick={() => ride.start()} disabled={!devices.trainer}>Start</button
      >
      <button onclick={() => ride.close()}>Close</button>
    {:else if s.status === 'finished'}
      <span class="done">Workout complete.</span>
      <button onclick={() => ride.close()}>Close</button>
    {:else}
      {#if s.status === 'running'}
        <button onclick={() => ride.pause()}>Pause</button>
      {:else}
        <button class="primary" onclick={() => ride.resume()}>Resume</button>
      {/if}
      <button onclick={() => ride.skip()}>Skip step</button>
      <button onclick={() => ride.end()}>End</button>

      <span class="sep"></span>
      <button onclick={() => ride.adjustIntensity(-0.05)}>−5</button>
      <button onclick={() => ride.adjustIntensity(-0.01)}>−1</button>
      <button class="intensity" onclick={() => ride.resetIntensity()} title="Reset to 100 %">
        {formatPct(s.intensity)}
      </button>
      <button onclick={() => ride.adjustIntensity(0.01)}>+1</button>
      <button onclick={() => ride.adjustIntensity(0.05)}>+5</button>
    {/if}
    <label class="mute"><input type="checkbox" bind:checked={ride.muted} /> Mute</label>
  </section>
  {#if devices.error}
    <p class="error">{devices.error}</p>
  {/if}
{:else}
  <h1>Ride</h1>

  {#if !devices.trainer}
    <p class="muted">No trainer connected.</p>
    <button onclick={() => go('settings')}>Devices…</button>
  {:else}
    {#if devices.trainerStatus === 'reconnecting'}
      <p class="warn">
        Trainer connection lost, reconnecting… The target is re-applied when it's back.
      </p>
    {/if}
    <div class="tiles">
      <Tile label="Power" value={devices.data?.powerW} unit="W" accent={powerAccent} />
      <Tile label="Target" value={ergOn ? ergWatts : undefined} unit="W" />
      <Tile label="Heart rate" value={devices.bpm} unit="bpm" />
      <Tile label="Cadence" value={devices.data?.cadenceRpm} unit="rpm" />
      <Tile label="Speed" value={devices.data?.speedKmh} unit="km/h" />
    </div>

    <section class="controls">
      {#if ergOn}
        <button onclick={() => setErg(ergWatts - STEP_W)}>−{STEP_W} W</button>
        <span class="erg">ERG {ergWatts} W</span>
        <button onclick={() => setErg(ergWatts + STEP_W)}>+{STEP_W} W</button>
        <button onclick={() => devices.setControl({ kind: 'free' })}>Free ride</button>
      {:else}
        <button onclick={() => setErg(ergWatts)}>ERG mode</button>
      {/if}
      <button onclick={() => go('workouts')}>Choose a workout…</button>
    </section>
    {#if devices.error}
      <p class="error">{devices.error}</p>
    {/if}
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
  .done {
    font-weight: 600;
    color: var(--ok);
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
