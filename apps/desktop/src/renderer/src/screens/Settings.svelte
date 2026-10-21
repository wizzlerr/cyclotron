<script lang="ts">
  import { devices } from '../devices/devices.svelte'
  import type { FtpEntry, FtpSource } from '../../../shared/api'
  import { go } from '../nav.svelte'
  import { profile } from '../profile.svelte'
  import { rideTiles, TILES } from '../ride/tiles.svelte'

  let fitFolder = $state('')
  let ftpHistory = $state.raw<FtpEntry[]>([])
  $effect(() => {
    void profile.ftpVersion
    void window.cyclotron.ftp.history(10).then((h) => (ftpHistory = h))
  })
  const SOURCE: Record<FtpSource, string> = {
    manual: 'set by hand',
    ramp: 'ramp test',
    '20min': '20-min test',
    estimate: 'estimate',
  }
  $effect(() => {
    void window.cyclotron.rides.fitFolder().then((f) => (fitFolder = f))
  })

  async function chooseFitFolder(): Promise<void> {
    fitFolder = (await window.cyclotron.rides.chooseFitFolder()) ?? fitFolder
  }

  const relayedHr = $derived(
    devices.heartRate !== undefined && devices.heartRate === devices.trainer?.heartRate,
  )
</script>

<h1>Settings</h1>

<section class="card">
  <h2>Profile</h2>
  <label>
    FTP
    <input
      type="number"
      min="50"
      max="600"
      value={profile.ftpW}
      onchange={(e) => profile.setFtp(e.currentTarget.valueAsNumber)}
    />
    W
  </label>
  <label>
    Weight
    <input
      type="number"
      min="30"
      max="200"
      step="0.1"
      value={profile.weightKg ?? ''}
      onchange={(e) => profile.setWeight(e.currentTarget.valueAsNumber)}
    />
    kg
  </label>
  <label>
    Max heart rate
    <input
      type="number"
      min="120"
      max="230"
      value={profile.maxHr ?? ''}
      onchange={(e) => profile.setMaxHr(e.currentTarget.valueAsNumber)}
    />
    bpm
  </label>
  <p class="muted">
    Workout targets are a percentage of FTP; run an FTP test from Workouts to measure it. Weight
    gives W/kg; max heart rate gives heart rate zones.
  </p>
  {#if ftpHistory.length > 0}
    <h3>FTP history</h3>
    <ul class="history">
      {#each ftpHistory as h (h.date)}
        <li>
          {new Date(h.date).toLocaleDateString()} · <b>{h.ftpW} W</b>
          <span class="muted">({SOURCE[h.source]})</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<section class="card">
  <h2>Ride screen</h2>
  <div class="tile-choices">
    {#each TILES as t (t.id)}
      <label>
        <input
          type="checkbox"
          checked={rideTiles.shown.includes(t.id)}
          onchange={() => rideTiles.toggle(t.id)}
        />
        {t.label}
      </label>
    {/each}
  </div>
  <button onclick={() => rideTiles.reset()}>Reset to default</button>
</section>

<section class="card">
  <h2>Trainer</h2>
  {#if devices.trainer}
    <p>
      <b>{devices.trainer.name}</b>
      {#if devices.trainerStatus === 'reconnecting'}<span class="warn">· reconnecting…</span>{/if}
    </p>
    <button onclick={() => devices.disconnectTrainer()}>Disconnect</button>
  {:else if devices.connecting === 'trainer'}
    <p class="muted">Connecting… on Windows this can take up to a minute.</p>
  {:else}
    <div class="row">
      {#if devices.remembered.trainer}
        <button onclick={() => devices.connectTrainer(devices.remembered.trainer)}>
          Connect {devices.remembered.trainer}
        </button>
      {/if}
      <button onclick={() => devices.connectTrainer()} disabled={devices.connecting !== undefined}>
        Find trainer…
      </button>
      <button onclick={() => devices.connectSimulated()}>Use simulated trainer</button>
    </div>
    <p class="muted">Wake the trainer by pedalling. Keep the PC close to it: range is poor.</p>
  {/if}
</section>

<section class="card">
  <h2>Heart rate</h2>
  {#if devices.heartRate}
    <p>
      <b>{devices.heartRate.name}</b> · {devices.bpm ?? '–'} bpm
      {#if devices.heartRateStatus === 'reconnecting'}<span class="warn">· reconnecting…</span>{/if}
    </p>
    {#if !relayedHr && devices.trainer?.kind !== 'simulated'}
      <button onclick={() => devices.disconnectHeartRate()}>Disconnect</button>
    {/if}
  {:else if devices.connecting === 'heartRate'}
    <p class="muted">Connecting…</p>
  {:else}
    <div class="row">
      {#if devices.remembered.heartRate}
        <button onclick={() => devices.connectHeartRate(devices.remembered.heartRate)}>
          Connect {devices.remembered.heartRate}
        </button>
      {/if}
      <button
        onclick={() => devices.connectHeartRate()}
        disabled={devices.connecting !== undefined}
      >
        Find heart rate strap…
      </button>
    </div>
    <p class="muted">A strap paired to the KICKR shows up here automatically once it sends data.</p>
  {/if}
  {#if relayedHr}
    <p class="muted">
      Relayed by the trainer. Connect the strap directly for a separate link:
      <button onclick={() => devices.connectHeartRate()}>Find strap…</button>
    </p>
  {/if}
</section>

{#if devices.error}
  <p class="error">{devices.error}</p>
{/if}

{#if devices.remembered.trainer || devices.remembered.heartRate}
  <section class="card">
    <h2>Remembered devices</h2>
    {#if devices.remembered.trainer}
      <p>
        Trainer: {devices.remembered.trainer}
        <button onclick={() => devices.forget('trainer')}>Forget</button>
      </p>
    {/if}
    {#if devices.remembered.heartRate}
      <p>
        Heart rate: {devices.remembered.heartRate}
        <button onclick={() => devices.forget('heartRate')}>Forget</button>
      </p>
    {/if}
  </section>
{/if}

<section class="card">
  <h2>Ride files</h2>
  <p>Each finished ride is saved as a FIT file in <code>{fitFolder}</code></p>
  <button onclick={chooseFitFolder}>Change folder…</button>
  <p class="muted">Upload these to Garmin Connect or Strava. Automatic upload comes later.</p>
</section>

<section class="card">
  <h2>Developer</h2>
  <button onclick={() => go('spike')}>BLE spike (E1-0)…</button>
</section>

<style>
  input[type='number'] {
    width: 5rem;
    margin: 0 0.25rem;
  }
  label + label {
    margin-left: 1.25rem;
  }
  h3 {
    font-size: 0.9rem;
    margin: 1rem 0 0.25rem;
  }
  .history {
    margin: 0;
    padding-left: 1.25rem;
  }
  .tile-choices {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 0.25rem;
    margin-bottom: 0.75rem;
  }
  .tile-choices label {
    margin-left: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .warn {
    color: var(--warn);
  }
  .error {
    color: var(--error);
    max-width: 40rem;
  }
</style>
