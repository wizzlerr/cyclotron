import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { addDays, localDate, type DailyWellness } from '@cyclotron/core'
import { BrowserWindow, ipcMain, safeStorage, shell } from 'electron'
import { IPC, type IntervalsStatus, type PlannedWorkout } from '../shared/api'
import { getDb, getSetting, setSetting } from './db'
import { logLine } from './log'

// intervals.icu (E18, DESIGN.md D31): upload rides; pull the planned workouts from the rider's
// calendar, daily wellness (resting HR, HRV, sleep) for readiness and the cycling FTP. Uses the rider's own API key (intervals.icu → Settings → Developer Settings),
// sent as Basic auth with the user name "API_KEY". The key is encrypted with the OS key store and
// never leaves main or gets logged. Athlete "0" means the key's own athlete.

const BASE_URL = 'https://intervals.icu/api/v1/athlete/0'
const ACTIVITY_URL = 'https://intervals.icu/activities/'
const KEY_SETTING = 'intervals.apiKey'
const META_SETTING = 'intervals.meta'
const AUTO_SETTING = 'intervals.auto'
const PLANNED_SETTING = 'intervals.planned'
const TIMEOUT_MS = 30_000
/** Days ahead (from today) of planned workouts to fetch. */
const PLAN_DAYS = 7
/** A plain refresh reuses the last fetch when it's this fresh. */
const PLAN_FRESH_MS = 10 * 60_000
/** Wellness days fetched; readiness needs a two-week baseline. */
const WELLNESS_DAYS = 21
/** intervals.icu activity types Cyclotron can ride on a trainer. */
const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide'])

interface Meta {
  hint?: string
  athlete?: string
  lastOkAt?: number
  plannedAt?: number
  /** Cycling FTP on intervals.icu: the indoor one when the rider set one. */
  ftpW?: number
  ftpField?: 'ftp' | 'indoor_ftp'
}

type ErrorCode = NonNullable<IntervalsStatus['error']>

export class IntervalsError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status?: number,
  ) {
    super(status ? `${code} ${status}` : code)
  }
}

function readMeta(): Meta {
  try {
    return JSON.parse(getSetting(META_SETTING) ?? '{}') as Meta
  } catch {
    return {}
  }
}

function writeMeta(meta: Meta): void {
  setSetting(META_SETTING, JSON.stringify(meta))
}

function storedKey(): string | undefined {
  const enc = getSetting(KEY_SETTING)
  if (!enc || !safeStorage.isEncryptionAvailable()) return undefined
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    return undefined
  }
}

function status(): IntervalsStatus {
  const meta = readMeta()
  return {
    connected: !!storedKey(),
    keyHint: meta.hint,
    athlete: meta.athlete,
    lastOkAt: meta.lastOkAt,
    plannedAt: meta.plannedAt,
    ftpW: meta.ftpW,
    auto: getSetting(AUTO_SETTING) === '1',
    encryption: safeStorage.isEncryptionAvailable(),
  }
}

async function call(
  path: string,
  init: RequestInit = {},
  key = storedKey(),
  timeoutMs = TIMEOUT_MS,
): Promise<unknown> {
  if (!key) throw new IntervalsError('noKey')
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
        Authorization: `Basic ${Buffer.from(`API_KEY:${key}`).toString('base64')}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    throw new IntervalsError('network')
  }
  if (res.status === 401 || res.status === 403) throw new IntervalsError('invalidKey', res.status)
  if (!res.ok) throw new IntervalsError('http', res.status)
  writeMeta({ ...readMeta(), lastOkAt: Date.now() })
  return res.json().catch(() => ({}))
}

/** Checks the key against the athlete profile and saves it (encrypted) when it works. */
async function setKey(key: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) throw new IntervalsError('encryption')
  const athlete = (await call('', {}, key)) as { name?: string; firstname?: string }
  setSetting(KEY_SETTING, safeStorage.encryptString(key).toString('base64'))
  writeMeta({
    hint: key.slice(-4),
    athlete: athlete.name || athlete.firstname || undefined,
    lastOkAt: Date.now(),
  })
}

const todayLocal = (): string => localDate(Date.now(), -new Date().getTimezoneOffset())

/** Planned event id from a ride's workout id (`icu.<eventId>`), to pair the upload with it. */
const eventIdOf = (workoutId: string | null): number | undefined => {
  const m = /^icu\.(\d+)$/.exec(workoutId ?? '')
  return m ? Number(m[1]) : undefined
}

interface EventJson {
  id: number
  start_date_local?: string
  category?: string
  type?: string
  name?: string
  description?: string
  moving_time?: number
  icu_training_load?: number
  workout_file_base64?: string
}

/** Daily wellness into `external_daily` (source 'intervals'), next to Garmin's. */
async function fetchWellness(): Promise<void> {
  const today = todayLocal()
  const query = new URLSearchParams({ oldest: addDays(today, -WELLNESS_DAYS), newest: today })
  const days = (await call(`/wellness.json?${query}`)) as {
    id?: string
    restingHR?: number | null
    hrv?: number | null
    sleepSecs?: number | null
  }[]
  const db = getDb()
  const insert = db.prepare(
    `insert into external_daily (date, source, json) values (?, 'intervals', ?)
     on conflict (date, source) do update set json = excluded.json`,
  )
  let n = 0
  for (const d of Array.isArray(days) ? days : []) {
    if (!d.id) continue
    const w: Omit<DailyWellness, 'date'> = {
      restingHr: d.restingHR ?? undefined,
      hrv: d.hrv ?? undefined,
      sleepS: d.sleepSecs ?? undefined,
    }
    if (w.restingHr === undefined && w.hrv === undefined && w.sleepS === undefined) continue
    insert.run(d.id.slice(0, 10), JSON.stringify(w))
    n++
  }
  logLine('main', 'info', `intervals: ${n} wellness days`)
}

/** The cycling FTP from the Ride sport settings. */
async function fetchFtp(): Promise<void> {
  const s = (await call('/sport-settings/Ride')) as {
    ftp?: number | null
    indoor_ftp?: number | null
  }
  const indoor = !!s.indoor_ftp
  writeMeta({
    ...readMeta(),
    ftpW: (indoor ? s.indoor_ftp : s.ftp) ?? undefined,
    ftpField: indoor ? 'indoor_ftp' : 'ftp',
  })
}

/** Sets the cycling FTP on intervals.icu (the same field it was read from). */
async function sendFtp(watts: number): Promise<void> {
  const field = readMeta().ftpField ?? 'ftp'
  await call('/sport-settings/Ride?recalcHrZones=false', {
    method: 'PUT',
    body: JSON.stringify({ [field]: watts }),
  })
  writeMeta({ ...readMeta(), ftpW: watts, ftpField: field })
}

/** Planned rides, wellness and FTP; tells the windows so the Today card can recompute. */
async function sync(): Promise<void> {
  const results = await Promise.allSettled([fetchPlanned(), fetchWellness(), fetchFtp()])
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(IPC.intervalsSynced)
  const failed = results.find((r) => r.status === 'rejected')
  if (failed) throw failed.reason
}

/** Fetches this week's planned rides (as .zwo, converted by intervals.icu) and caches them. */
async function fetchPlanned(): Promise<void> {
  const today = todayLocal()
  const query = new URLSearchParams({
    oldest: today,
    newest: addDays(today, PLAN_DAYS - 1),
    category: 'WORKOUT',
    ext: 'zwo',
  })
  const events = (await call(`/events.json?${query}`)) as EventJson[]
  const planned: Omit<PlannedWorkout, 'done'>[] = []
  for (const e of Array.isArray(events) ? events : []) {
    // Rest days, notes and other sports have no .zwo; a ride without steps has none either.
    if (!e.workout_file_base64 || (e.type && !RIDE_TYPES.has(e.type))) continue
    planned.push({
      eventId: e.id,
      date: (e.start_date_local ?? today).slice(0, 10),
      name: e.name ?? '',
      description: e.description || undefined,
      zwo: Buffer.from(e.workout_file_base64, 'base64').toString('utf8'),
      loadTss: e.icu_training_load ?? undefined,
    })
  }
  setSetting(PLANNED_SETTING, JSON.stringify(planned))
  writeMeta({ ...readMeta(), plannedAt: Date.now() })
  logLine('main', 'info', `intervals: ${planned.length} planned rides`)
}

/**
 * Cached planned rides with the ones already ridden here marked done. The last two days stay in so
 * an interrupted ride of yesterday's workout can still be continued; the UI shows today on.
 */
function cachedPlanned(): PlannedWorkout[] {
  let planned: Omit<PlannedWorkout, 'done'>[]
  try {
    planned = JSON.parse(getSetting(PLANNED_SETTING) ?? '[]') as typeof planned
  } catch {
    planned = []
  }
  const today = todayLocal()
  const ridden = new Set(
    (
      getDb()
        .prepare(
          "select workout_id from rides where status = 'finished' and workout_id like 'icu.%'",
        )
        .all() as { workout_id: string }[]
    ).map((r) => r.workout_id),
  )
  return planned
    .filter((p) => p.date >= addDays(today, -2))
    .map((p) => ({ ...p, done: ridden.has(`icu.${p.eventId}`) }))
}

/** Uploads a ride's FIT file; returns the intervals.icu activity id. Remembers it on the ride. */
export async function uploadRide(rideId: number): Promise<string> {
  const db = getDb()
  const row = db
    .prepare('select fit_path, workout_id, workout_name, intervals_id from rides where id = ?')
    .get(rideId) as
    | {
        fit_path: string | null
        workout_id: string | null
        workout_name: string
        intervals_id: string | null
      }
    | undefined
  if (row?.intervals_id) return row.intervals_id
  if (!row?.fit_path) throw new IntervalsError('noFit')
  const query = new URLSearchParams({
    name: row.workout_name,
    external_id: `cyclotron-${rideId}-${basename(row.fit_path)}`,
  })
  const eventId = eventIdOf(row.workout_id)
  if (eventId !== undefined) query.set('paired_event_id', String(eventId))
  const form = new FormData()
  form.set('file', new Blob([await readFile(row.fit_path)]), basename(row.fit_path))
  const res = (await call(
    `/activities?${query}`,
    { method: 'POST', body: form },
    undefined,
    60_000,
  )) as { id?: string; activities?: { id?: string }[] }
  const id = res.activities?.[0]?.id ?? res.id
  if (!id) throw new IntervalsError('rejected')
  db.prepare('update rides set intervals_id = ? where id = ?').run(String(id), rideId)
  return String(id)
}

/** After a ride is saved: upload it when the rider turned that on (failures only go to the log). */
export function autoUpload(rideId: number): void {
  if (getSetting(AUTO_SETTING) !== '1' || !storedKey()) return
  uploadRide(rideId).then(
    (id) => logLine('main', 'info', `intervals: ride ${rideId} uploaded as ${id}`),
    (e: unknown) =>
      logLine('main', 'warn', `intervals: auto-upload of ride ${rideId} failed: ${String(e)}`),
  )
}

const errorOf = (e: unknown): Pick<IntervalsStatus, 'error' | 'status'> =>
  e instanceof IntervalsError ? { error: e.code, status: e.status } : { error: 'network' }

export function registerIntervalsIpc(): void {
  ipcMain.handle(IPC.intervalsStatus, () => status())

  ipcMain.handle(IPC.intervalsSetKey, async (_event, key: unknown) => {
    if (typeof key !== 'string' || key.trim().length < 8 || key.length > 200)
      return { ...status(), error: 'invalidKey' }
    try {
      await setKey(key.trim())
      await sync().catch(() => {})
      return status()
    } catch (e) {
      return { ...status(), ...errorOf(e) }
    }
  })

  ipcMain.handle(IPC.intervalsDisconnect, () => {
    getDb()
      .prepare('delete from settings where key in (?, ?, ?, ?)')
      .run(KEY_SETTING, META_SETTING, AUTO_SETTING, PLANNED_SETTING)
    getDb().exec(`delete from external_daily where source = 'intervals'`)
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send(IPC.intervalsSynced)
    return status()
  })

  ipcMain.handle(IPC.intervalsSetAuto, (_event, on: unknown) => {
    setSetting(AUTO_SETTING, on === true ? '1' : '0')
    return status()
  })

  ipcMain.handle(IPC.intervalsUpload, async (_event, rideId: unknown) => {
    if (typeof rideId !== 'number') return { ...status(), error: 'noFit' }
    try {
      const id = await uploadRide(rideId)
      return { ...status(), activityUrl: `${ACTIVITY_URL}${id}` }
    } catch (e) {
      return { ...status(), ...errorOf(e) }
    }
  })

  ipcMain.handle(IPC.intervalsSetFtp, async (_event, watts: unknown) => {
    if (typeof watts !== 'number' || !Number.isInteger(watts) || watts < 50 || watts > 600)
      return { ...status(), error: 'http' }
    try {
      await sendFtp(watts)
      return status()
    } catch (e) {
      return { ...status(), ...errorOf(e) }
    }
  })

  ipcMain.handle(IPC.intervalsOpenActivity, (_event, id: unknown) => {
    if (typeof id === 'string' && /^[\w-]{1,40}$/.test(id))
      void shell.openExternal(`${ACTIVITY_URL}${id}`)
  })

  ipcMain.handle(IPC.intervalsOpenCalendar, () => {
    void shell.openExternal('https://intervals.icu/calendar')
  })

  // `refresh`: 'force' always fetches, 'auto' only when the cache is stale, 'none' never.
  ipcMain.handle(IPC.intervalsPlanned, async (_event, refresh: unknown) => {
    let error: Pick<IntervalsStatus, 'error' | 'status'> = {}
    const stale = Date.now() - (readMeta().plannedAt ?? 0) > PLAN_FRESH_MS
    if (storedKey() && (refresh === 'force' || (refresh === 'auto' && stale))) {
      try {
        await sync()
      } catch (e) {
        error = errorOf(e)
        logLine('main', 'warn', `intervals: sync failed: ${String(e)}`)
      }
    }
    return { planned: storedKey() ? cachedPlanned() : [], status: { ...status(), ...error } }
  })
}
