<script lang="ts">
  import { masonry } from '../lib/masonry'
  import { GOALS, PLAYER_TEST_WORKOUT, type Goal } from '@cyclotron/core'
  import ControllersCard from '../components/ControllersCard.svelte'
  import DataCard from '../components/DataCard.svelte'
  import GarminCard from '../components/GarminCard.svelte'
  import IntervalsCard from '../components/IntervalsCard.svelte'
  import StravaCard from '../components/StravaCard.svelte'
  import { devices } from '../devices/devices.svelte'
  import type { FtpEntry } from '../../../shared/api'
  import { formatDate, i18n, LANGUAGES, type Lang } from '../i18n/i18n.svelte'
  import { t } from '../i18n/t'
  import { display, UI_SCALES } from '../lib/display.svelte'
  import { go, nav, SETTINGS_TABS } from '../nav.svelte'
  import RideTiles from '../components/RideTiles.svelte'
  import { profile } from '../profile.svelte'
  import { saveDiagnosticReport } from '../lib/report'
  import { updates } from '../lib/updates.svelte'
  import { stepCue } from '../ride/cues'
  import { ride } from '../ride/session.svelte'
  import { sound } from '../ride/sound.svelte'
  import { worldPrefs } from '../world/prefs.svelte'

  let fitFolder = $state('')
  let ftpHistory = $state.raw<FtpEntry[]>([])
  $effect(() => {
    void profile.ftpVersion
    void window.cyclotron.ftp.history(10).then((h) => (ftpHistory = h))
  })
  const s = $derived(t().app.settings)
  const tr = $derived(t().reco.settings)
  let diagPath = $state<string | undefined>()
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

<div class="tabs" role="tablist" aria-label={s.title}>
  {#each SETTINGS_TABS as id (id)}
    <button
      role="tab"
      class="tab"
      class:on={nav.settingsTab === id}
      aria-selected={nav.settingsTab === id}
      onclick={() => (nav.settingsTab = id)}>{s.tabs[id]}</button
    >
  {/each}
</div>

{#key nav.settingsTab}
  <div class="cards" role="tabpanel" use:masonry>
    {#if nav.settingsTab === 'devices'}
      {#if devices.error}
        <p class="error wide">{devices.error}</p>
      {/if}

      <section class="card">
        <h2>{s.trainer}</h2>
        {#if devices.trainer}
          <p>
            <b>{devices.trainer.name}</b>
            {#if devices.trainerStatus === 'reconnecting'}<span class="warn">{s.reconnecting}</span
              >{/if}
          </p>
          {@const caps = devices.trainer.capabilities()}
          <p class="muted">
            {s.capabilities(
              [
                caps.erg ? 'ERG' : '',
                caps.resistance ? s.capResistance : '',
                caps.simulation ? s.capSimulation : '',
              ]
                .filter(Boolean)
                .join(', '),
            )}
            {caps.calibration ? s.calibrationAvailable : s.calibrationNone}
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
            {#if devices.heartRateStatus === 'reconnecting'}<span class="warn"
                >{s.reconnecting}</span
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
      <ControllersCard />
    {:else if nav.settingsTab === 'profile'}
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
        <h2>{tr.title}</h2>
        <label>
          {tr.goal}
          <select
            value={profile.goal}
            onchange={(e) => profile.setGoal(e.currentTarget.value as Goal)}
          >
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
      <section class="card">
        <h2>{s.rideFiles}</h2>
        <p>{s.rideFilesIn} <code>{fitFolder}</code></p>
        <button onclick={chooseFitFolder}>{s.changeFolder}</button>
        <p class="muted">{s.rideFilesHelp}</p>
      </section>
      <DataCard />
    {:else if nav.settingsTab === 'ride'}
      <section class="card wide">
        <h2>{s.rideTiles}</h2>
        <p class="muted">{s.tilesHelp}</p>
        <RideTiles editor />
      </section>
      <section class="card">
        <h2>{s.rideScreen}</h2>
        <h3>{s.cueVolume}</h3>
        <label class="volume">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={sound.volume}
            oninput={(e) => sound.setVolume(e.currentTarget.valueAsNumber)}
            aria-label={s.cueVolume}
          />
          {sound.volume === 0 ? s.cueOff : `${sound.volume} %`}
        </label>
        <button onclick={() => stepCue()} disabled={sound.volume === 0}>{s.cueTest}</button>
        <p class="muted">{s.cueVolumeHelp}</p>
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
        <h2>{t().world.settings.title}</h2>
        <label class="block">
          <input
            type="checkbox"
            checked={worldPrefs.enabled}
            onchange={(e) => worldPrefs.setEnabled(e.currentTarget.checked)}
          />
          {t().world.settings.show}
        </label>
        <label class="block">
          {t().world.settings.quality}
          <select
            value={worldPrefs.quality}
            onchange={(e) => worldPrefs.setQuality(e.currentTarget.value as 'low' | 'high')}
          >
            <option value="high">{t().world.settings.high}</option>
            <option value="low">{t().world.settings.low}</option>
          </select>
        </label>
        <p class="muted">{t().world.settings.help}</p>
      </section>
    {:else if nav.settingsTab === 'connections'}
      <IntervalsCard />
      <GarminCard />
      <StravaCard />
    {:else}
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
        <h2>{s.display}</h2>
        <label>
          {s.uiSize}
          <select
            value={display.scale}
            onchange={(e) => display.setScale(Number(e.currentTarget.value))}
          >
            {#each UI_SCALES as scale (scale)}<option value={scale}
                >{Math.round(scale * 100)} %</option
              >{/each}
          </select>
        </label>
        <p class="muted">{s.uiSizeHelp}</p>
      </section>
      <section class="card">
        <h2>{t().app.update.title}</h2>
        <label class="block">
          <input
            type="checkbox"
            checked={updates.status?.auto ?? true}
            onchange={(e) => updates.setAuto(e.currentTarget.checked)}
          />
          {t().app.update.auto}
        </label>
        <button
          onclick={() => updates.check()}
          disabled={updates.status?.state === 'checking' || updates.status?.state === 'dev'}
          >{t().app.update.check}</button
        >
        {#if updates.status}<p class="muted">{t().app.update.state(updates.status)}</p>{/if}
      </section>
      <section class="card">
        <h2>{s.problemTitle}</h2>
        <p class="muted">{s.problemHelp}</p>
        <div class="row">
          <button
            onclick={async () => {
              diagPath = (await saveDiagnosticReport()) ?? diagPath
            }}>{s.saveReport}</button
          >
          <button onclick={() => window.cyclotron.diag.openLogs()}>{s.openLogs}</button>
          <button onclick={() => window.cyclotron.diag.reportIssue()}>{s.reportIssue}</button>
        </div>
        {#if diagPath}<p class="muted">{s.reportSaved(diagPath)}</p>{/if}
        <p class="muted">{s.reportPrivacy}</p>
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
    {/if}
  </div>
{/key}

<style>
  .volume input {
    width: 12rem;
    vertical-align: middle;
  }
  label.block {
    display: block;
    margin: 0.35rem 0 0;
  }
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
  /* The tile editor spans every column, so tiles look as they will on the Ride screen. */
  .wide {
    grid-column: 1 / -1;
    max-width: none;
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
  .error.wide {
    grid-column: 1 / -1;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin: 0 0 1rem;
    border-bottom: 1px solid var(--grid);
  }
  .tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    margin-bottom: -1px;
    padding: 0.5rem 0.9rem;
    color: var(--muted);
  }
  .tab:hover {
    color: var(--fg);
  }
  .tab.on {
    color: var(--fg);
    border-bottom-color: var(--series-1);
    font-weight: 600;
  }
</style>
