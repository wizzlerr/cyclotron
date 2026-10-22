// The ground for the virtual world (E16): detailed ground around the road and low-detail land out
// to the horizon. Runs in a worker (terrain.worker.ts), or here if a worker can't start.
import {
  distantLand,
  RoadIndex,
  terrainGrid,
  type TerrainGrid,
  type WorldPoint,
} from '@cyclotron/core'

export interface TerrainRequest {
  pts: WorldPoint[]
  seed: number
  periodZ?: number
}

export interface TerrainResult {
  /** Detailed ground around the road. */
  near: TerrainGrid
  /** Low-detail land out to the horizon. */
  far: TerrainGrid
}

export function buildTerrain({ pts, seed, periodZ }: TerrainRequest): TerrainResult {
  return {
    near: terrainGrid(pts, new RoadIndex(pts), seed, 120, 15, 220, periodZ),
    far: distantLand(pts, seed, 2000, 150, periodZ),
  }
}
