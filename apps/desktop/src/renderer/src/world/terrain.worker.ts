// Builds the ground off the main thread (E16): long routes take up to a second, which would freeze
// the window when the world is turned on.
import { buildTerrain, type TerrainRequest } from './terrain'

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<TerrainRequest>) => void) | null
  postMessage(message: unknown, transfer: Transferable[]): void
}

ctx.onmessage = (e) => {
  const r = buildTerrain(e.data)
  ctx.postMessage(r, [
    r.near.positions.buffer,
    r.near.indices.buffer,
    r.far.positions.buffer,
    r.far.indices.buffer,
  ])
}
