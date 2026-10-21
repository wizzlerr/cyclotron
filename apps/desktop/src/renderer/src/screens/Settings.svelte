<script lang="ts">
  import { devices } from '../devices/devices.svelte'
  import type { FtpEntry, FtpSource } from '../../../shared/api'
  import { display, UI_SCALES } from '../lib/display.svelte'
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
  let version = $state('')
  $effect(() => {
    void window.cyclotron.app.getVersion().then((v) => (version = v))
  })
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

<div class="cards">
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
    <label>
      Bike weight
      <input
        type="number"
        min="3"
        max="40"
        step="0.1"
        value={profile.bikeKg}
        onchange={(e) => profile.setBikeKg(e.currentTarget.valueAsNumber)}
      />
      kg
    </label>
    <p class="muted">
      Workout targets are a percentage of FTP; run an FTP test from Workouts to measure it. Weight
      gives W/kg; max heart rate gives heart rate zones. Weight and bike weight set your speed on
      routes.
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
    <h2>Routes</h2>
    <label class="difficulty">
      Trainer difficulty
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={Math.round(profile.difficulty * 100)}
        oninput={(e) => profile.setDifficulty(e.currentTarget.valueAsNumber / 100)}
      />
      {Math.round(profile.difficulty * 100)} %
    </label>
    <p class="muted">
      How much of the road's grade the trainer applies, like Zwift: at 50 % a 10 % climb feels like
      5 %. Your speed and the recorded ride always use the real grade.
    </p>
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
        <button
          onclick={() => devices.connectTrainer()}
          disabled={devices.connecting !== undefined}
        >
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
        {#if devices.heartRateStatus === 'reconnecting'}<span class="warn">· reconnecting…</span
          >{/if}
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
      <p class="muted">
        A strap paired to the KICKR shows up here automatically once it sends data.
      </p>
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
    <h2>Display</h2>
    <label>
      Interface size
      <select
        value={display.scale}
        onchange={(e) => display.setScale(Number(e.currentTarget.value))}
      >
        {#each UI_SCALES as s (s)}<option value={s}>{Math.round(s * 100)} %</option>{/each}
      </select>
    </label>
    <p class="muted">
      Makes everything bigger or smaller, on top of your system's display scaling. Useful on a 4K
      screen at 100 % scaling, or to read the ride screen from further away.
    </p>
  </section>

  <section class="card">
    <h2>Ride files</h2>
    <p>Each finished ride is saved as a FIT file in <code>{fitFolder}</code></p>
    <button onclick={chooseFitFolder}>Change folder…</button>
    <p class="muted">Upload these to Garmin Connect or Strava. Automatic upload comes later.</p>
  </section>

  <section class="card">
    <h2>About</h2>
    <p>Cyclotron {version}</p>
    <button onclick={() => window.cyclotron.app.showDataFolder()}>Show data folder…</button>
    <p class="muted">Rides, workouts and settings live here. Copy the folder to back them up.</p>
  </section>

  <section class="card">
    <h2>Developer</h2>
    <button onclick={() => go('spike')}>BLE spike (E1-0)…</button>
  </section>
</div>

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
  .difficulty input {
    width: 12rem;
    vertical-align: middle;
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
