<script lang="ts">
  // Settings → Controllers: Zwift Play / Click / Ride buttons, with a live tester.
  import { devices, rememberedLabel } from '../devices/devices.svelte'
  import { t } from '../i18n/t'

  const c = $derived(t().controllers)
  const connected = $derived(new Set(devices.controllers.map((x) => x.label)))
</script>

<section class="card">
  <h2>{c.title}</h2>
  <p class="muted">{c.intro}</p>
  {#each devices.controllers as ctl (ctl.label)}
    <p>
      <b>{ctl.label}</b>
      <button class="small" onclick={() => devices.disconnectController(ctl)}>{c.disconnect}</button
      >
    </p>
  {/each}
  <div class="row">
    {#each devices.rememberedControllers.filter((r) => !connected.has(rememberedLabel(r))) as r (rememberedLabel(r))}
      <button
        onclick={() => devices.connectController(r)}
        disabled={devices.connecting !== undefined}>{c.connect(rememberedLabel(r))}</button
      >
      <button class="small" onclick={() => devices.forgetController(r)}>{c.forget}</button>
    {/each}
    <button onclick={() => devices.connectController()} disabled={devices.connecting !== undefined}
      >{c.add}</button
    >
  </div>
  {#if devices.controllers.length > 0}
    <p class="tester" aria-live="polite">
      {devices.lastPress
        ? c.lastPress(c.buttons[devices.lastPress.button], devices.lastPress.from)
        : c.pressAny}
    </p>
  {/if}
  <details>
    <summary>{c.mappingTitle}</summary>
    <ul class="mapping">
      {#each c.mapping as line (line)}<li>{line}</li>{/each}
    </ul>
  </details>
  <p class="muted">{c.help}</p>
</section>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin: 0.5rem 0;
  }
  .small {
    font-size: 0.8rem;
    padding: 0.1rem 0.5rem;
    margin-left: 0.5rem;
  }
  .tester {
    font-weight: 600;
    color: var(--series-1);
  }
  .mapping {
    margin: 0.25rem 0;
    padding-left: 1.2rem;
    font-size: 0.9rem;
  }
</style>
