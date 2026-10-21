<script lang="ts">
  let { title, text }: { title: string; text: string } = $props()
</script>

<h1>{title}</h1>
<p class="muted">{text}</p>
