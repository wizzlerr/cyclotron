<script lang="ts">
  import { GOALS, PLAYER_TEST_WORKOUT, type Goal } from '@cyclotron/core'
  import GarminCard from '../components/GarminCard.svelte'
  import { devices } from '../devices/devices.svelte'
  import type { FtpEntry } from '../../../shared/api'
  import { formatDate, i18n, LANGUAGES, type Lang } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { display, UI_SCALES } from '../lib/display.svelte'
  import { go } from '../nav.svelte'
  import { profile } from '../profile.svelte'
  import { ride } from '../ride/session.svelte'
  import { rideTiles, TILES } from '../ride/tiles.svelte'

  let fitFolder = $state('')
  let ftpHistory = $state.raw<FtpEntry[]>([])
  $effect(() => {
    void profile.ftpVersion
    void window.cyclotron.ftp.history(10).then((h) => (ftpHistory = h))
  })
  const s = $derived(t().app.settings)
  const tr = $derived(t().reco.settings)
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

<h1>{s.title}</h1>

<div class="cards">
  <section class="card">
    <h2>{s.language}</h2>
    <select
      value={i18n.lang}
      onchange={(e) => i18n.set(e.currentTarget.value as Lang)}
      aria-label={s.language}
    >
      {#each LANGUAGES as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
    </select>
  </section>

  <section class="card">
    <h2>{tr.title}</h2>
    <label>
      {tr.goal}
      <select value={profile.goal} onchange={(e) => profile.setGoal(e.currentTarget.value as Goal)}>
        {#each GOALS as g (g)}<option value={g}>{tr.goals[g]}</option>{/each}
      </select>
    </label>
    <label>
      {tr.weeklyHours}
      <input
        type="number"
        min="1"
        max="30"
        step="0.5"
        value={profile.weeklyHours}
        onchange={(e) => profile.setWeeklyHours(e.currentTarget.valueAsNumber)}
      />
      h
    </label>
    <div class="days" role="group" aria-label={tr.rideDays}>
      <span>{tr.rideDays}</span>
      {#each [1, 2, 3, 4, 5, 6, 0] as d (d)}
        <label class="day">
          <input
            type="checkbox"
            checked={profile.rideDays.includes(d)}
            onchange={() => profile.toggleRideDay(d)}
          />
          {tr.days[d]}
        </label>
      {/each}
    </div>
    {#if profile.rideDays.length === 0}<p class="muted">{tr.anyDay}</p>{/if}
    <p class="muted">{tr.hint}</p>
  </section>

  <GarminCard />

  <section class="card">
    <h2>{s.profile}</h2>
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
      {s.weight}
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
      {s.maxHr}
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
      {s.bikeWeight}
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
    <p class="muted">{s.profileHelp}</p>
    {#if ftpHistory.length > 0}
      <h3>{s.ftpHistory}</h3>
      <ul class="history">
        {#each ftpHistory as h (h.date)}
          <li>
            {formatDate(h.date)} · <b>{h.ftpW} W</b>
            <span class="muted">({s.ftpSource[h.source]})</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="card">
    <h2>{s.routes}</h2>
    <label class="difficulty">
      {s.difficulty}
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
    <p class="muted">{s.difficultyHelp}</p>
  </section>

  <section class="card">
    <h2>{s.rideScreen}</h2>
    <div class="tile-choices">
      {#each TILES as tile (tile.id)}
        <label>
          <input
            type="checkbox"
            checked={rideTiles.shown.includes(tile.id)}
            onchange={() => rideTiles.toggle(tile.id)}
          />
          {tile.label}
        </label>
      {/each}
    </div>
    <button onclick={() => rideTiles.reset()}>{s.resetTiles}</button>
  </section>

  <section class="card">
    <h2>{s.trainer}</h2>
    {#if devices.trainer}
      <p>
        <b>{devices.trainer.name}</b>
        {#if devices.trainerStatus === 'reconnecting'}<span class="warn">{s.reconnecting}</span
          >{/if}
      </p>
      <button onclick={() => devices.disconnectTrainer()}>{s.disconnect}</button>
    {:else if devices.connecting === 'trainer'}
      <p class="muted">{s.connectingSlow}</p>
    {:else}
      <div class="row">
        {#if devices.remembered.trainer}
          <button onclick={() => devices.connectTrainer(devices.remembered.trainer)}>
            {s.connect(devices.remembered.trainer)}
          </button>
        {/if}
        <button
          onclick={() => devices.connectTrainer()}
          disabled={devices.connecting !== undefined}
        >
          {s.findTrainer}
        </button>
        <button onclick={() => devices.connectSimulated()}>{s.useSimulated}</button>
      </div>
      <p class="muted">{s.trainerHelp}</p>
    {/if}
  </section>

  <section class="card">
    <h2>{s.heartRate}</h2>
    {#if devices.heartRate}
      <p>
        <b>{devices.heartRate.name}</b> · {devices.bpm ?? '–'} bpm
        {#if devices.heartRateStatus === 'reconnecting'}<span class="warn">{s.reconnecting}</span
          >{/if}
      </p>
      {#if !relayedHr && devices.trainer?.kind !== 'simulated'}
        <button onclick={() => devices.disconnectHeartRate()}>{s.disconnect}</button>
      {/if}
    {:else if devices.connecting === 'heartRate'}
      <p class="muted">{s.connecting}</p>
    {:else}
      <div class="row">
        {#if devices.remembered.heartRate}
          <button onclick={() => devices.connectHeartRate(devices.remembered.heartRate)}>
            {s.connect(devices.remembered.heartRate)}
          </button>
        {/if}
        <button
          onclick={() => devices.connectHeartRate()}
          disabled={devices.connecting !== undefined}
        >
          {s.findStrap}
        </button>
      </div>
      <p class="muted">{s.strapHelp}</p>
    {/if}
    {#if relayedHr}
      <p class="muted">
        {s.relayed}
        <button onclick={() => devices.connectHeartRate()}>{s.findStrapShort}</button>
      </p>
    {/if}
  </section>

  {#if devices.error}
    <p class="error">{devices.error}</p>
  {/if}

  {#if devices.remembered.trainer || devices.remembered.heartRate}
    <section class="card">
      <h2>{s.remembered}</h2>
      {#if devices.remembered.trainer}
        <p>
          {s.rememberedTrainer(devices.remembered.trainer)}
          <button onclick={() => devices.forget('trainer')}>{s.forget}</button>
        </p>
      {/if}
      {#if devices.remembered.heartRate}
        <p>
          {s.rememberedHr(devices.remembered.heartRate)}
          <button onclick={() => devices.forget('heartRate')}>{s.forget}</button>
        </p>
      {/if}
    </section>
  {/if}

  <section class="card">
    <h2>{s.display}</h2>
    <label>
      {s.uiSize}
      <select
        value={display.scale}
        onchange={(e) => display.setScale(Number(e.currentTarget.value))}
      >
        {#each UI_SCALES as scale (scale)}<option value={scale}>{Math.round(scale * 100)} %</option
          >{/each}
      </select>
    </label>
    <p class="muted">{s.uiSizeHelp}</p>
  </section>

  <section class="card">
    <h2>{s.rideFiles}</h2>
    <p>{s.rideFilesIn} <code>{fitFolder}</code></p>
    <button onclick={chooseFitFolder}>{s.changeFolder}</button>
    <p class="muted">{s.rideFilesHelp}</p>
  </section>

  <section class="card">
    <h2>{s.about}</h2>
    <p>{t().common.appName} {version}</p>
    <button onclick={() => window.cyclotron.app.showDataFolder()}>{s.showDataFolder}</button>
    <p class="muted">{s.dataFolderHelp}</p>
  </section>

  <section class="card">
    <h2>{s.developer}</h2>
    <button onclick={() => go('spike')}>BLE spike (E1-0)…</button>
    <button onclick={() => ride.load(PLAYER_TEST_WORKOUT) && go('ride')}>{s.playerTest}</button>
  </section>
</div>

<style>
  .days {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.75rem;
    margin: 0.5rem 0;
  }
  .days .day {
    margin-left: 0;
  }
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
