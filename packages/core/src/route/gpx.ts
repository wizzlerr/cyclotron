// GPX import (E13-2). Track points (or route points if there is no track) with optional
// elevation; everything else (time, extensions, waypoints) is ignored.

import { decodeXml } from '../xml'

export interface GpxPoint {
  lat: number
  lon: number
  /** Metres; missing in some GPX files (e.g. drawn routes). */
  ele?: number
}

export interface Gpx {
  name?: string
  points: GpxPoint[]
}

/** `code` lets the UI word the error in its own language (DESIGN.md D21). */
export class GpxError extends Error {
  constructor(
    readonly code: 'notGpx' | 'noPoints',
    message: string,
  ) {
    super(message)
  }
}

const POINT = /<(trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1\s*>)/g
const ELE = /<ele>\s*([^<]*?)\s*<\/ele>/
const NAME = /<name>([\s\S]*?)<\/name>/

export function parseGpx(xml: string): Gpx {
  const text = xml.replace(/<!--[\s\S]*?-->/g, '')
  if (!/<gpx\b/.test(text)) throw new GpxError('notGpx', 'not a GPX file: no <gpx> element')

  const track: GpxPoint[] = []
  const route: GpxPoint[] = []
  for (const m of text.matchAll(POINT)) {
    const lat = attr(m[2]!, 'lat')
    const lon = attr(m[2]!, 'lon')
    if (lat === undefined || lon === undefined || Math.abs(lat) > 90 || Math.abs(lon) > 180)
      continue
    const eleText = m[3] ? ELE.exec(m[3])?.[1] : undefined
    const ele = eleText === undefined || eleText === '' ? undefined : Number(eleText)
    const point: GpxPoint = { lat, lon }
    if (ele !== undefined && Number.isFinite(ele)) point.ele = ele
    ;(m[1] === 'trkpt' ? track : route).push(point)
  }
  const points = track.length > 0 ? track : route
  if (points.length < 2) throw new GpxError('noPoints', 'the GPX file has no track or route points')

  // Prefer the track's name; the metadata name is often just the exporting app.
  const trk = /<trk\b[\s\S]*?<\/trk>/.exec(text)?.[0] ?? /<rte\b[\s\S]*?<\/rte>/.exec(text)?.[0]
  const rawName = (trk && NAME.exec(trk)?.[1]) ?? NAME.exec(text)?.[1]
  const name = rawName ? decodeXml(rawName.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1')).trim() : ''
  return { name: name || undefined, points }
}

function attr(attrs: string, name: string): number | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs)
  const n = m ? Number(m[1] ?? m[2]) : NaN
  return Number.isFinite(n) ? n : undefined
}
