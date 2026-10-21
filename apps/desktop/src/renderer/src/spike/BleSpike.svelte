<script lang="ts">
  import {
    encodeRequestControl,
    encodeReset,
    encodeSetIndoorBikeSimulation,
    encodeSetTargetPower,
    encodeStartOrResume,
    encodeStop,
    uuidName,
  } from '@cyclotron/core'
  import DevicePicker from '../components/DevicePicker.svelte'
  import { BleSession } from './session.svelte'

  const session = new BleSession()
  let watts = $state(150)
  let grade = $state(0)
  let savedPath = $state<string | null>(null)

  const busy = $derived(session.status === 'requesting' || session.status === 'connecting')
  const fmt = (n: number | undefined, unit: string): string =>
    n === undefined ? '–' : `${Math.round(n * 10) / 10} ${unit}`

  async function save(): Promise<void> {
    savedPath = await window.cyclotron.spike.saveCapture(JSON.stringify(session.capture(), null, 2))
  }
</script>

<DevicePicker open={session.status === 'requesting'} />

<section class="bar">
  <button onclick={() => session.connect()} disabled={busy}>Connect device…</button>
  <label title="FTMS + Heart Rate only; skips Cycling Power and Wahoo services">
    <input type="checkbox" bind:checked={session.lean} disabled={busy} /> Lean
  </label>
  <button onclick={() => session.disconnect()} disabled={session.status !== 'connected'}>
    Disconnect
  </button>
  <button onclick={save} disabled={session.status === 'idle'}>Save capture…</button>
  <span class="muted">
    {session.status}{session.deviceName ? ` · ${session.deviceName}` : ''} · {session.packetCount} packets
  </span>
  {#if savedPath}<span class="muted">saved {savedPath}</span>{/if}
</section>

<div class="grid">
  <section>
    <h2>Live</h2>
    <div class="tiles">
      <div><b>{fmt(session.bike.powerW, 'W')}</b><span>FTMS power</span></div>
      <div><b>{fmt(session.cpsPowerW, 'W')}</b><span>CPS power</span></div>
      <div><b>{fmt(session.bike.cadenceRpm, 'rpm')}</b><span>cadence</span></div>
      <div><b>{fmt(session.bike.speedKmh, 'km/h')}</b><span>speed</span></div>
      <div><b>{fmt(session.heartRateBpm, 'bpm')}</b><span>heart rate</span></div>
    </div>

    <h2>FTMS control</h2>
    {#if session.hasControlPoint}
      <div class="controls">
        <button onclick={() => session.control('Request Control', encodeRequestControl())}>
          1. Request control
        </button>
        <button onclick={() => session.control('Start/Resume', encodeStartOrResume())}>
          2. Start
        </button>
        <span>
          <input type="number" min="50" max="400" step="5" bind:value={watts} /> W
          <button
            onclick={() =>
              session.control(
                `ERG ${watts} W`,
                encodeSetTargetPower(Math.min(400, Math.max(50, watts))),
              )}>Set ERG</button
          >
        </span>
        <span>
          <input type="number" min="-10" max="15" step="0.5" bind:value={grade} /> %
          <button
            onclick={() =>
              session.control(
                `Grade ${grade} %`,
                encodeSetIndoorBikeSimulation({ gradePct: grade }),
              )}>Set grade</button
          >
        </span>
        <button onclick={() => session.control('Stop', encodeStop())}>Stop</button>
        <button onclick={() => session.control('Reset', encodeReset())}>Reset</button>
      </div>
      {#if session.lastResponse}
        <p class:ok={session.lastResponse.ok} class:bad={!session.lastResponse.ok}>
          Last response: op 0x{session.lastResponse.requestOp.toString(16).padStart(2, '0')} → {session
            .lastResponse.result}
        </p>
      {/if}
    {:else}
      <p class="muted">No FTMS control point on this device.</p>
    {/if}

    {#if session.features}
      <h2>FTMS features</h2>
      <p><b>Machine:</b> {session.features.machine.join(', ') || 'none'}</p>
      <p><b>Targets:</b> {session.features.targets.join(', ') || 'none'}</p>
    {/if}

    <h2>Values read</h2>
    <table>
      <tbody>
        {#each session.reads as r (r.uuid)}
          <tr>
            <td>{r.name ?? r.uuid}</td>
            <td>{r.text ?? ''}</td>
            <td class="hex">{r.hex}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h2>Services</h2>
    {#each session.services as s (s.uuid)}
      <details open>
        <summary>{s.name ?? 'Unknown'} <span class="hex">{s.uuid}</span></summary>
        <ul>
          {#each s.characteristics as c (c.uuid)}
            <li>
              {c.name ?? 'Unknown'} <span class="hex">{c.uuid}</span>
              <span class="muted">[{c.properties.join(', ')}]</span>
            </li>
          {/each}
        </ul>
      </details>
    {/each}
  </section>

  <section class="log">
    <h2>Log <span class="muted">(newest first)</span></h2>
    <table>
      <tbody>
        {#each session.visibleLog as e (e.seq)}
          <tr class={e.kind}>
            <td>{(e.t / 1000).toFixed(2)}</td>
            <td>{e.kind}</td>
            <td>{e.uuid ? (uuidName(e.uuid) ?? e.uuid.slice(0, 8)) : ''}</td>
            <td class="hex">{e.hex ?? ''}</td>
            <td>{e.note ?? ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
</div>

<style>
  .bar {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #2a313a;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem;
    padding: 0 1rem;
    height: calc(100vh - 6rem);
  }
  .grid > section {
    overflow: auto;
  }
  h2 {
    font-size: 1rem;
    margin: 1.25rem 0 0.5rem;
  }
  .tiles {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .tiles div {
    background: #1b2027;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    min-width: 6rem;
    display: flex;
    flex-direction: column;
  }
  .tiles b {
    font-size: 1.4rem;
  }
  .tiles span {
    color: var(--muted);
    font-size: 0.8rem;
  }
  .controls {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
  }
  input[type='number'] {
    width: 4.5rem;
  }
  table {
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  td {
    padding: 0.1rem 0.5rem 0.1rem 0;
    vertical-align: top;
  }
  .hex {
    font-family: ui-monospace, monospace;
    color: #9fc3ff;
  }
  .muted {
    color: var(--muted);
    font-size: 0.85em;
  }
  .ok {
    color: #6fd08c;
  }
  .bad,
  tr.error {
    color: #ff7b7b;
  }
  tr.write {
    color: #ffd27b;
  }
  tr.info {
    color: var(--muted);
  }
</style>
