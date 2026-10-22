import { mkdir, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import {
  IPC,
  type FtpEntry,
  type RideFeedback,
  type RideSample,
  type RideStartInfo,
  type RideTotals,
  type StoredRide,
} from '../shared/api'
import { computeAggregates } from './analytics'
import { getDb, getSetting, setSetting, transaction } from './db'
import { strings } from './i18n'
import { autoUpload } from './strava'

// Ride recording storage (E5-1), FIT files (E5-3) and FTP history (E6-3). The renderer computes summaries and encodes
// FIT with core; main only stores rows and writes files.

const FIT_FOLDER_KEY = 'fitFolder'
const GARMIN_IMPORT_URL = 'https://connect.garmin.com/modern/import-data'
const FEEDBACK = new Set<RideFeedback>(['easy', 'right', 'hard', 'failed'])

export interface RideRow {
  id: number
  started_at: number
  utc_offset_min: number
  ended_at: number | null
  status: 'active' | 'finished'
  workout_id: string | null
  workout_name: string
  route_id: string | null
  ftp_at_ride: number
  duration_s: number | null
  timer_s: number | null
  avg_power: number | null
  np: number | null
  intensity: number | null
  tss: number | null
  kj: number | null
  avg_hr: number | null
  max_hr: number | null
  distance_m: number | null
  feedback: RideFeedback | null
  fit_path: string | null
  source: 'recorded' | 'import'
  strava_id: number | null
}

export interface SampleRow {
  t: number
  power: number | null
  cadence: number | null
  speed: number | null
  hr: number | null
  target: number | null
  segment: number | null
  paused: number
  lat: number | null
  lon: number | null
  alt: number | null
  dist: number | null
}

export function fitFolder(): string {
  return getSetting(FIT_FOLDER_KEY) ?? join(app.getPath('documents'), 'Cyclotron')
}

export function registerRidesIpc(): void {
  ipcMain.handle(IPC.ridesStart, (_event, info: RideStartInfo) => {
    const r = getDb()
      .prepare(
        `insert into rides (started_at, utc_offset_min, workout_id, workout_name, ftp_at_ride, route_id)
         values (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        info.startedAt,
        info.utcOffsetMin,
        info.workoutId,
        info.workoutName,
        info.ftpW,
        info.routeId ?? null,
      )
    return Number(r.lastInsertRowid)
  })

  ipcMain.handle(IPC.ridesAppend, (_event, rideId: number, samples: RideSample[]) => {
    const db = getDb()
    const insert = db.prepare(
      `insert or replace into ride_samples
         (ride_id, t, power, cadence, speed, hr, target, segment, paused, lat, lon, alt, dist)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    transaction(db, () => {
      for (const s of samples) {
        insert.run(
          rideId,
          s.t,
          int(s.powerW),
          int(s.cadenceRpm),
          s.speedKmh ?? null,
          int(s.heartRateBpm),
          int(s.targetW),
          s.segment ?? null,
          s.paused ? 1 : 0,
          s.lat ?? null,
          s.lon ?? null,
          s.altitudeM ?? null,
          s.distanceM ?? null,
        )
      }
    })
  })

  ipcMain.handle(
    IPC.ridesFinish,
    async (
      _event,
      rideId: number,
      totals: RideTotals,
      fit: { fileName: string; bytes: Uint8Array },
    ) => {
      let fitPath: string | null = null
      let fitError: string | undefined
      try {
        const folder = fitFolder()
        await mkdir(folder, { recursive: true })
        fitPath = join(folder, basename(fit.fileName))
        await writeFile(fitPath, fit.bytes, { flag: 'wx' }).catch(async (e: unknown) => {
          // Same name already there (two rides in one minute): add the ride id.
          if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
          fitPath = fitPath!.replace(/\.fit$/, `_${rideId}.fit`)
          await writeFile(fitPath, fit.bytes)
        })
      } catch (e) {
        fitPath = null
        fitError = e instanceof Error ? e.message : String(e)
      }
      getDb()
        .prepare(
          `update rides set status = 'finished', ended_at = started_at + ? * 1000,
             duration_s = ?, timer_s = ?, avg_power = ?, np = ?, intensity = ?, tss = ?, kj = ?,
             avg_hr = ?, max_hr = ?, distance_m = ?, fit_path = ?
           where id = ?`,
        )
        .run(
          totals.durationS,
          totals.durationS,
          totals.timerS,
          totals.avgPowerW,
          totals.npW,
          totals.intensity,
          totals.tss,
          totals.kj,
          totals.avgHrBpm ?? null,
          totals.maxHrBpm ?? null,
          totals.distanceM,
          fitPath,
          rideId,
        )
      try {
        computeAggregates(rideId)
      } catch (e) {
        // Not fatal: the backfill on next start tries again.
        console.error('aggregates failed', e)
      }
      if (fitPath) autoUpload(rideId)
      return { fitPath, fitError }
    },
  )

  ipcMain.handle(IPC.ridesUnfinished, () => {
    const db = getDb()
    const row = db
      .prepare(`select * from rides where status = 'active' order by started_at desc limit 1`)
      .get() as RideRow | undefined
    if (!row) return null
    const samples = (
      db
        .prepare('select * from ride_samples where ride_id = ? order by t')
        .all(row.id) as unknown as SampleRow[]
    ).map(toSample)
    return { ride: toRide(row), samples }
  })

  ipcMain.handle(IPC.ridesDiscard, async (_event, rideId: number) => {
    const row = rideRow(rideId)
    if (!row) return
    if (row.fit_path) await rm(row.fit_path, { force: true })
    getDb().prepare('delete from rides where id = ?').run(rideId)
  })

  ipcMain.handle(IPC.ridesFeedback, (_event, rideId: number, feedback: RideFeedback) => {
    if (!FEEDBACK.has(feedback)) return
    getDb().prepare('update rides set feedback = ? where id = ?').run(feedback, rideId)
  })

  ipcMain.handle(IPC.ridesList, (_event, limit: number) => {
    const rows = getDb()
      .prepare(`select * from rides where status = 'finished' order by started_at desc limit ?`)
      .all(Math.max(1, Math.min(1000, Math.floor(limit)))) as unknown as RideRow[]
    return rows.map(toRide)
  })

  ipcMain.handle(IPC.ridesWorkoutsDone, () =>
    getDb()
      .prepare(
        `select workout_id as workoutId, count(*) as count, max(started_at) as lastAt
         from rides where status = 'finished' and workout_id is not null and workout_id != ''
         group by workout_id`,
      )
      .all(),
  )

  // E12-4: Garmin has no upload for apps like ours (DESIGN.md D23), so hand the rider the file
  // and Garmin's import page.
  ipcMain.handle(IPC.ridesSendToGarmin, async (_event, rideId: number) => {
    const path = rideRow(rideId)?.fit_path
    if (path) shell.showItemInFolder(path)
    await shell.openExternal(GARMIN_IMPORT_URL)
  })

  ipcMain.handle(IPC.ridesShowFit, (_event, rideId: number) => {
    const path = rideRow(rideId)?.fit_path
    if (path) shell.showItemInFolder(path)
  })

  ipcMain.handle(IPC.ridesFitFolder, () => fitFolder())

  ipcMain.handle(IPC.ftpHistory, (_event, limit: number) => {
    const rows = getDb()
      .prepare(
        'select date, ftp_w, source, ride_id from ftp_history order by date desc, id desc limit ?',
      )
      .all(Math.max(1, Math.min(1000, Math.floor(limit)))) as unknown as {
      date: number
      ftp_w: number
      source: FtpEntry['source']
      ride_id: number | null
    }[]
    return rows.map((r): FtpEntry => ({
      date: r.date,
      ftpW: r.ftp_w,
      source: r.source,
      rideId: r.ride_id ?? undefined,
    }))
  })

  ipcMain.handle(IPC.ftpRecord, (_event, e: FtpEntry) => {
    getDb()
      .prepare('insert into ftp_history (date, ftp_w, source, ride_id) values (?, ?, ?, ?)')
      .run(e.date, Math.round(e.ftpW), e.source, e.rideId ?? null)
  })

  ipcMain.handle(IPC.ridesChooseFitFolder, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: strings().fitFolderTitle,
      defaultPath: fitFolder(),
      properties: ['openDirectory', 'createDirectory'],
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    const folder = result.filePaths[0]
    if (result.canceled || !folder) return null
    setSetting(FIT_FOLDER_KEY, folder)
    return folder
  })
}

export function rideRow(id: number): RideRow | undefined {
  return getDb().prepare('select * from rides where id = ?').get(id) as RideRow | undefined
}

export function toRide(r: RideRow): StoredRide {
  return {
    id: r.id,
    startedAt: r.started_at,
    utcOffsetMin: r.utc_offset_min,
    workoutId: r.workout_id ?? '',
    workoutName: r.workout_name,
    routeId: r.route_id ?? undefined,
    ftpW: r.ftp_at_ride,
    status: r.status,
    endedAt: r.ended_at ?? undefined,
    feedback: r.feedback ?? undefined,
    fitPath: r.fit_path ?? undefined,
    source: r.source,
    stravaId: r.strava_id ?? undefined,
    totals:
      r.status === 'finished'
        ? {
            durationS: r.duration_s ?? 0,
            timerS: r.timer_s ?? 0,
            avgPowerW: r.avg_power ?? 0,
            npW: r.np ?? 0,
            intensity: r.intensity ?? 0,
            tss: r.tss ?? 0,
            kj: r.kj ?? 0,
            avgHrBpm: r.avg_hr ?? undefined,
            maxHrBpm: r.max_hr ?? undefined,
            distanceM: r.distance_m ?? 0,
          }
        : undefined,
  }
}

export function toSample(r: SampleRow): RideSample {
  return {
    t: r.t,
    powerW: r.power ?? undefined,
    cadenceRpm: r.cadence ?? undefined,
    speedKmh: r.speed ?? undefined,
    heartRateBpm: r.hr ?? undefined,
    targetW: r.target ?? undefined,
    segment: r.segment ?? undefined,
    paused: r.paused === 1,
    lat: r.lat ?? undefined,
    lon: r.lon ?? undefined,
    altitudeM: r.alt ?? undefined,
    distanceM: r.dist ?? undefined,
  }
}

export const int = (n: number | undefined): number | null =>
  n === undefined ? null : Math.round(n)
