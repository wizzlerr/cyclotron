import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import {
  addDays,
  dailyLoad,
  decodeFitActivity,
  localDate,
  powerCurve,
  summarizeRide,
  zoneTimes,
  type DailyLoad,
  type RideSample,
} from '@cyclotron/core'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import {
  IPC,
  type BestPower,
  type FtpEstimate,
  type ImportResult,
  type RideDetail,
  type WeekZones,
} from '../shared/api'
import { getDb, getSetting, transaction } from './db'
import { fitFolder, int, rideRow, toRide, toSample, type SampleRow } from './rides'

// History and analytics (E9, DESIGN.md §4.4, D19). Per-ride aggregates are computed once when a
// ride is saved, with the same core code the server will use (E8); queries then only read them.

const ESTIMATE_DAYS = 90
const DEFAULT_FTP_W = 200
/** Rides starting this close together are the same ride (re-import of the same file). */
const SAME_RIDE_MS = 60_000

/** Power curve and time in zones for one ride, from its stored samples. */
export function computeAggregates(rideId: number): void {
  const db = getDb()
  const ride = rideRow(rideId)
  if (!ride) return
  const rows = db
    .prepare('select power, paused from ride_samples where ride_id = ? order by t')
    .all(rideId) as { power: number | null; paused: number }[]
  const power = rows.filter((r) => r.paused !== 1).map((r) => r.power ?? 0)
  const curve = powerCurve(power)
  const zones = zoneTimes(power, ride.ftp_at_ride)
  transaction(db, () => {
    db.prepare('delete from ride_power_curve where ride_id = ?').run(rideId)
    db.prepare('delete from ride_zone_time where ride_id = ?').run(rideId)
    const c = db.prepare(
      'insert into ride_power_curve (ride_id, duration_s, watts) values (?, ?, ?)',
    )
    for (const p of curve) c.run(rideId, p.durationS, p.watts)
    const z = db.prepare('insert into ride_zone_time (ride_id, zone, seconds) values (?, ?, ?)')
    zones.forEach((s, i) => z.run(rideId, i + 1, s))
    db.prepare('update rides set aggregates_at = ? where id = ?').run(Date.now(), rideId)
  })
}

/** Rides saved before E9 (or whose aggregates failed) get them now. */
export function backfillAggregates(): void {
  const ids = getDb()
    .prepare(`select id from rides where status = 'finished' and aggregates_at is null`)
    .all() as { id: number }[]
  for (const { id } of ids) {
    try {
      computeAggregates(id)
    } catch (e) {
      console.error('aggregates failed for ride', id, e)
    }
  }
}

export function registerAnalyticsIpc(): void {
  ipcMain.handle(IPC.ridesDetail, (_event, rideId: number): RideDetail | null => {
    const row = rideRow(rideId)
    if (!row) return null
    const db = getDb()
    const samples = (
      db
        .prepare('select * from ride_samples where ride_id = ? order by t')
        .all(rideId) as unknown as SampleRow[]
    ).map(toSample)
    const curve = db
      .prepare(
        'select duration_s as durationS, watts from ride_power_curve where ride_id = ? order by duration_s',
      )
      .all(rideId) as { durationS: number; watts: number }[]
    const zones = [0, 0, 0, 0, 0, 0, 0]
    const zoneRows = db
      .prepare('select zone, seconds from ride_zone_time where ride_id = ?')
      .all(rideId) as { zone: number; seconds: number }[]
    for (const z of zoneRows) zones[z.zone - 1] = z.seconds
    return { ride: toRide(row), samples, curve, zones }
  })

  ipcMain.handle(IPC.analyticsPowerCurve, (_event, days: number | null): BestPower[] => {
    const since = days === null ? 0 : Date.now() - days * 86_400_000
    return getDb()
      .prepare(
        `select duration_s as durationS, watts, ride_id as rideId, started_at as startedAt,
                workout_name as rideName
           from (select c.duration_s, c.watts, c.ride_id, r.started_at, r.workout_name,
                        row_number() over (partition by c.duration_s order by c.watts desc) as rank
                   from ride_power_curve c join rides r on r.id = c.ride_id
                  where r.status = 'finished' and r.started_at >= ?)
          where rank = 1
          order by duration_s`,
      )
      .all(since) as unknown as BestPower[]
  })

  ipcMain.handle(IPC.analyticsLoad, (): DailyLoad[] => {
    const tss = tssByDay()
    const dates = [...tss.keys()].sort()
    if (dates.length === 0) return []
    return dailyLoad(tss, dates[0]!, today())
  })

  ipcMain.handle(IPC.analyticsZonesByWeek, (_event, weeks: number): WeekZones[] => {
    const n = Math.max(1, Math.min(104, Math.floor(weeks)))
    const lastWeek = weekStart(today())
    const firstWeek = addDays(lastWeek, -7 * (n - 1))
    const out = new Map<string, number[]>()
    for (let w = firstWeek; w <= lastWeek; w = addDays(w, 7)) out.set(w, [0, 0, 0, 0, 0, 0, 0])
    const rows = getDb()
      .prepare(
        `select r.started_at, r.utc_offset_min, z.zone, z.seconds
           from ride_zone_time z join rides r on r.id = z.ride_id
          where r.status = 'finished'`,
      )
      .all() as { started_at: number; utc_offset_min: number; zone: number; seconds: number }[]
    for (const r of rows) {
      const week = out.get(weekStart(localDate(r.started_at, r.utc_offset_min)))
      if (week) week[r.zone - 1]! += r.seconds
    }
    return [...out].map(([weekStart, seconds]) => ({ weekStart, seconds }))
  })

  ipcMain.handle(IPC.analyticsFtpEstimate, (): FtpEstimate | null => {
    const row = getDb()
      .prepare(
        `select c.watts, r.id, r.started_at, r.workout_name
           from ride_power_curve c join rides r on r.id = c.ride_id
          where c.duration_s = 1200 and r.status = 'finished' and r.started_at >= ?
          order by c.watts desc limit 1`,
      )
      .get(Date.now() - ESTIMATE_DAYS * 86_400_000) as
      { watts: number; id: number; started_at: number; workout_name: string } | undefined
    if (!row) return null
    return {
      ftpW: Math.round(row.watts * 0.95),
      best20W: Math.round(row.watts),
      rideId: row.id,
      startedAt: row.started_at,
      rideName: row.workout_name,
    }
  })

  ipcMain.handle(IPC.ridesImportFit, async (event): Promise<ImportResult> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Import rides from FIT files',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'FIT activities', extensions: ['fit'] }],
    }
    const picked = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    const result: ImportResult = { imported: 0, skipped: [] }
    if (picked.canceled) return result
    for (const path of picked.filePaths) {
      const name = basename(path)
      try {
        const why = await importFitFile(path)
        if (why) result.skipped.push(`${name}: ${why}`)
        else result.imported++
      } catch (e) {
        result.skipped.push(`${name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    return result
  })
}

/** Adds one FIT file to the history; returns why it was skipped, if it was. */
async function importFitFile(path: string): Promise<string | undefined> {
  const activity = decodeFitActivity(new Uint8Array(await readFile(path)))
  if (activity.sport && activity.sport !== 'cycling') return `not a ride (${activity.sport})`
  const db = getDb()
  const duplicate = db
    .prepare('select id from rides where abs(started_at - ?) < ? limit 1')
    .get(activity.startedAtMs, SAME_RIDE_MS)
  if (duplicate) return 'already in your history'

  const startedAt = activity.startedAtMs
  const utcOffsetMin = activity.utcOffsetMin ?? -new Date(startedAt).getTimezoneOffset()
  const ftpW = activity.ftpW ?? ftpAt(startedAt)
  const samples = activity.samples
  const s = summarizeRide(samples, ftpW)
  const fitPath = await keepCopy(path)

  let rideId = 0
  transaction(db, () => {
    const r = db
      .prepare(
        `insert into rides (started_at, utc_offset_min, ended_at, status, workout_id, workout_name,
           ftp_at_ride, duration_s, timer_s, avg_power, np, intensity, tss, kj, avg_hr, max_hr,
           distance_m, fit_path, source)
         values (?, ?, ?, 'finished', 'import', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'import')`,
      )
      .run(
        startedAt,
        utcOffsetMin,
        startedAt + s.elapsedS * 1000,
        rideName(path),
        ftpW,
        s.elapsedS,
        s.timerS,
        s.avgPowerW,
        s.normalizedPowerW,
        s.intensity,
        s.tss,
        s.workKj,
        s.avgHeartRateBpm ?? null,
        s.maxHeartRateBpm ?? null,
        s.distanceM,
        fitPath,
      )
    rideId = Number(r.lastInsertRowid)
    insertSamples(rideId, samples)
  })
  computeAggregates(rideId)
  return undefined
}

function insertSamples(rideId: number, samples: readonly RideSample[]): void {
  const insert = getDb().prepare(
    `insert or replace into ride_samples
       (ride_id, t, power, cadence, speed, hr, target, segment, paused, lat, lon, alt, dist)
     values (?, ?, ?, ?, ?, ?, null, null, 0, ?, ?, ?, ?)`,
  )
  for (const s of samples) {
    insert.run(
      rideId,
      s.t,
      int(s.powerW),
      int(s.cadenceRpm),
      s.speedKmh ?? null,
      int(s.heartRateBpm),
      s.lat ?? null,
      s.lon ?? null,
      s.altitudeM ?? null,
      s.distanceM ?? null,
    )
  }
}

/** Imported files are copied into the ride folder (unless they're already there). */
async function keepCopy(path: string): Promise<string> {
  const folder = fitFolder()
  if (!relative(folder, path).startsWith('..')) return path
  const dir = join(folder, 'imported')
  await mkdir(dir, { recursive: true })
  const dest = join(dir, basename(path))
  await copyFile(path, dest).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== 'EEXIST') throw e
  })
  return dest
}

/** "Morning_Ride.fit" → "Morning Ride". */
function rideName(path: string): string {
  const name = basename(path)
    .replace(/\.fit$/i, '')
    .replace(/[_]+/g, ' ')
    .trim()
  return name || 'Imported ride'
}

/** The FTP the rider had then: FTP history, else the current profile, else a default. */
function ftpAt(ms: number): number {
  const row = getDb()
    .prepare('select ftp_w from ftp_history where date <= ? order by date desc limit 1')
    .get(ms) as { ftp_w: number } | undefined
  if (row) return row.ftp_w
  try {
    const profile = JSON.parse(getSetting('pref:cyclotron.profile') ?? '{}') as { ftpW?: number }
    return profile.ftpW ?? DEFAULT_FTP_W
  } catch {
    return DEFAULT_FTP_W
  }
}

function tssByDay(): Map<string, number> {
  const rows = getDb()
    .prepare(`select started_at, utc_offset_min, tss from rides where status = 'finished'`)
    .all() as { started_at: number; utc_offset_min: number; tss: number | null }[]
  const out = new Map<string, number>()
  for (const r of rows) {
    const d = localDate(r.started_at, r.utc_offset_min)
    out.set(d, (out.get(d) ?? 0) + (r.tss ?? 0))
  }
  return out
}

function today(): string {
  return localDate(Date.now(), -new Date().getTimezoneOffset())
}

/** Monday of the week `date` (YYYY-MM-DD) is in. */
function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()
  return addDays(date, -((dow + 6) % 7))
}
