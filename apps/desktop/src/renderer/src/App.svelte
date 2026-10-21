<script lang="ts">
  import DevicePicker from './components/DevicePicker.svelte'
  import DeviceStatus from './components/DeviceStatus.svelte'
  import { devices } from './devices/devices.svelte'
  import { nav, go, SCREENS } from './nav.svelte'
  import { recovery } from './ride/recovery.svelte'
  import History from './screens/History.svelte'
  import Home from './screens/Home.svelte'
  import Ride from './screens/Ride.svelte'
  import Settings from './screens/Settings.svelte'
  import Workouts from './screens/Workouts.svelte'
  import BleSpike from './spike/BleSpike.svelte'

  let version = $state('')
  window.cyclotron.app.getVersion().then((v) => (version = v))
  void recovery.check()
</script>

<DevicePicker open={devices.picking} />

<div class="shell">
  <nav>
    <div class="brand">Cyclotron</div>
    {#each SCREENS as s (s.id)}
      <button class:active={nav.screen === s.id} onclick={() => go(s.id)}>{s.label}</button>
    {/each}
    <div class="spacer"></div>
    <DeviceStatus />
    <span class="version">v{version}</span>
  </nav>

  <main>
    {#if nav.screen === 'home'}
      <Home />
    {:else if nav.screen === 'ride'}
      <Ride />
    {:else if nav.screen === 'workouts'}
      <Workouts />
    {:else if nav.screen === 'history'}
      <History />
    {:else if nav.screen === 'settings'}
      <Settings />
    {:else if nav.screen === 'spike'}
      <BleSpike />
    {/if}
  </main>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: 11rem 1fr;
    height: 100vh;
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem 0.75rem;
    background: var(--panel);
  }
  .brand {
    font-weight: 700;
    font-size: 1.15rem;
    margin: 0 0.5rem 1rem;
  }
  nav > button {
    text-align: left;
    background: none;
    border: none;
    color: var(--fg);
    font: inherit;
    padding: 0.5rem;
    border-radius: 6px;
    cursor: pointer;
  }
  nav > button:hover {
    background: #262d36;
  }
  nav > button.active {
    background: #2d3540;
    font-weight: 600;
  }
  .spacer {
    flex: 1;
  }
  .version {
    color: var(--muted);
    font-size: 0.75rem;
    padding: 0 0.5rem;
  }
  main {
    overflow: auto;
    padding: 1.5rem 2rem;
  }
</style>
