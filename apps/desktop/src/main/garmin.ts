import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { addDays, externalLoad, localDate, type DailyWellness } from '@cyclotron/core'
import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron'
import { IPC, type GarminStatus } from '../shared/api'
import { getDb, getSetting, setSetting } from './db'

// Garmin Connect Personal API (E12, DESIGN.md §9, D23): the rider's own key, read-only pulls.
// The key is encrypted with the OS key store (safeStorage) and never leaves main or gets logged.

const BASE_URL = 'https://personal.connectapi.garmin.com'
const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token'
const KEY_SETTING = 'garmin.apiKey'
const META_SETTING = 'garmin.meta'
const TIMEOUT_MS = 30_000
/** Renew the bearer token this long before it expires. */
const TOKEN_MARGIN_MS = 10 * 60_000

interface Meta {
  /** Last 4 characters of the key, to recognise it in Settings. */
  hint?: string
  savedAt?: number
  lastOkAt?: number
  lastSyncAt?: number
}

/** How far back the first sync reaches; later syncs overlap the last few days. */
const HISTORY_DAYS = 120
const OVERLAP_DAYS = 3
const WELLNESS_DAYS = 21
const PAGE = 100
/** Our own uploads: same start within this window, or FIT files written by this app. */
const SAME_RIDE_MS = 60_000
const OWN_MANUFACTURER = 'DEVELOPMENT'
/** While the app is open. */
const SYNC_EVERY_MS = 3 * 3600_000

/** A failure the renderer words in its language. */
export class GarminError extends Error {
  constructor(
    readonly code: 'noKey' | 'invalidKey' | 'network' | 'http' | 'encryption',
    readonly status?: number,
  ) {
    super(status ? `${code} ${status}` : code)
  }
}

let token: { value: string; expiresAt: number; forKey: string } | undefined

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

/** Seconds-since-epoch `exp` of a JWT, or 24 h from now if it can't be read. */
function jwtExpiryMs(jwt: string): number {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString()) as {
      exp?: number
    }
    if (typeof payload.exp === 'number') return payload.exp * 1000
  } catch {
    // fall through
  }
  return Date.now() + 24 * 3600_000
}

async function request(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${BASE_URL}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new GarminError('network')
  }
}

async function exchange(key: string): Promise<string> {
  const res = await request(TOKEN_PATH, {
    method: 'POST',
    headers: { Accept: '*/*', Authorization: `ApiKey ${key}` },
  })
  if (res.status === 401 || res.status === 403) throw new GarminError('invalidKey', res.status)
  if (!res.ok) throw new GarminError('http', res.status)
  const value = (await res.text()).trim()
  token = { value, expiresAt: jwtExpiryMs(value), forKey: key }
  return value
}

async function bearer(): Promise<string> {
  const key = storedKey()
  if (!key) throw new GarminError('noKey')
  if (token && token.forKey === key && token.expiresAt - Date.now() > TOKEN_MARGIN_MS) {
    return token.value
  }
  return exchange(key)
}

/** GET a Personal API path; JSON (or text when the response isn't JSON). */
export async function garminGet(path: string): Promise<unknown> {
  let res = await request(path, { headers: { Authorization: `Bearer ${await bearer()}` } })
  if (res.status === 401) {
    // Token revoked or expired early: exchange the key once more.
    token = undefined
    res = await request(path, { headers: { Authorization: `Bearer ${await bearer()}` } })
  }
  if (res.status === 401 || res.status === 403) throw new GarminError('invalidKey', res.status)
  if (!res.ok) throw new GarminError('http', res.status)
  const text = await res.text()
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function status(): GarminStatus {
  const meta = readMeta()
  return {
    connected: storedKey() !== undefined,
    keyHint: meta.hint,
    savedAt: meta.savedAt,
    lastOkAt: meta.lastOkAt,
    lastSyncAt: meta.lastSyncAt,
    activities: (
      getDb().prepare(`select count(*) as n from external_activities`).get() as { n: number }
    ).n,
    encryption: safeStorage.isEncryptionAvailable(),
  }
}

const errorCode = (e: unknown): { error: GarminError['code']; status?: number } =>
  e instanceof GarminError ? { error: e.code, status: e.status } : { error: 'network' }

interface GarminActivity {
  activityId: number
  activityName?: string
  startTimeGMT?: string
  startTimeLocal?: string
  activityType?: { typeKey?: string }
  duration?: number
  movingDuration?: number
  averageHR?: number
  trainingStressScore?: number
  intensityFactor?: number
  manufacturer?: string
  [key: string]: unknown
}

/** "2026-10-21 17:15:58" (no zone) as ms, read as UTC. */
const garminTime = (s: string): number => Date.parse(`${s.replace(' ', 'T')}Z`)

/** Seconds in Z1…Z7: power zones when the activity has them, else HR zones 1–5. */
function zoneSeconds(a: GarminActivity): number[] {
  const pick = (prefix: string, n: number): number[] =>
    Array.from({ length: 7 }, (_, i) => (i < n ? Number(a[`${prefix}${i + 1}`] ?? 0) : 0))
  const power = pick('powerTimeInZone_', 7)
  return power.some((s) => s > 0) ? power : pick('hrTimeInZone_', 5)
}

/** Lactate threshold HR for the HR-based load estimate: running zones first, then default. */
async function thresholdHr(): Promise<number | undefined> {
  const zones = (await garminGet('/biometric-service/heartRateZones/v2')) as
    { sport?: string; lactateThresholdHeartRateUsed?: number | null }[] | undefined
  if (!Array.isArray(zones)) return undefined
  const lthr = (sport: string): number | undefined =>
    zones.find((z) => z.sport === sport)?.lactateThresholdHeartRateUsed ?? undefined
  return lthr('RUNNING') ?? lthr('DEFAULT')
}

async function syncActivities(
  since: string,
  today: string,
  lthr: number | undefined,
): Promise<void> {
  const db = getDb()
  const own = db
    .prepare(`select started_at from rides where status = 'finished' and source = 'recorded'`)
    .all() as { started_at: number }[]
  const insert = db.prepare(
    `insert into external_activities
       (id, started_at, utc_offset_min, sport, name, duration_s, avg_hr, tss, intensity, zone_s)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict (id) do update set
       started_at = excluded.started_at, utc_offset_min = excluded.utc_offset_min,
       sport = excluded.sport, name = excluded.name, duration_s = excluded.duration_s,
       avg_hr = excluded.avg_hr, tss = excluded.tss, intensity = excluded.intensity,
       zone_s = excluded.zone_s`,
  )
  for (let start = 0; ; start += PAGE) {
    const page = (await garminGet(
      `/activitylist-service/activities/search/activities?start=${start}&limit=${PAGE}&startDate=${since}&endDate=${today}`,
    )) as GarminActivity[]
    if (!Array.isArray(page)) break
    for (const a of page) {
      if (!a.startTimeGMT || !a.activityId) continue
      const startedAt = garminTime(a.startTimeGMT)
      // Rides recorded here and sent to Garmin are already in the history.
      const isOwn =
        a.manufacturer === OWN_MANUFACTURER ||
        own.some((r) => Math.abs(r.started_at - startedAt) < SAME_RIDE_MS)
      if (isOwn) continue
      const offset = a.startTimeLocal
        ? Math.round((garminTime(a.startTimeLocal) - startedAt) / 60_000)
        : 0
      const durationS = a.movingDuration ?? a.duration ?? 0
      const load = externalLoad(
        { durationS, avgHr: a.averageHR, tss: a.trainingStressScore, intensity: a.intensityFactor },
        lthr,
      )
      insert.run(
        `garmin:${a.activityId}`,
        startedAt,
        offset,
        a.activityType?.typeKey ?? 'other',
        a.activityName ?? null,
        durationS,
        a.averageHR ?? null,
        load?.tss ?? null,
        load?.intensity ?? null,
        JSON.stringify(zoneSeconds(a)),
      )
    }
    if (page.length < PAGE) break
  }
}

interface GarminDailySummary {
  calendarDate?: string
  heartRate?: { restingValue?: number | null }
  bodyBattery?: { maxValue?: number | null }
  stress?: { totalDurationInMillis?: number | null }
}

async function syncWellness(today: string): Promise<void> {
  const from = addDays(today, -WELLNESS_DAYS)
  const res = (await garminGet(
    `/usersummary-service/v2/dailysummaries?startDate=${from}&endDate=${today}`,
  )) as { data?: GarminDailySummary[] } | undefined
  const days = new Map<string, Omit<DailyWellness, 'date'>>()
  for (const d of res?.data ?? []) {
    if (!d.calendarDate) continue
    days.set(d.calendarDate, {
      restingHr: d.heartRate?.restingValue ?? undefined,
      bodyBatteryMax: d.bodyBattery?.maxValue ?? undefined,
      coverageH: (d.stress?.totalDurationInMillis ?? 0) / 3_600_000,
    })
  }
  // Last night's sleep belongs to today.
  const sleep = (await garminGet(`/sleep-service/sleep/dailySleep?date=${today}`)) as
    { sleepTimeSeconds?: number | null } | undefined
  if (sleep?.sleepTimeSeconds) {
    days.set(today, { ...days.get(today), sleepS: sleep.sleepTimeSeconds })
  }
  const upsert = getDb().prepare(
    `insert into external_daily (date, source, json) values (?, 'garmin', ?)
     on conflict (date, source) do update set json = excluded.json`,
  )
  for (const [date, values] of days) upsert.run(date, JSON.stringify(values))
}

let syncing: Promise<GarminStatus> | undefined

/** Pulls other activities and wellness data (E12-5). One sync at a time. */
export function syncGarmin(): Promise<GarminStatus> {
  syncing ??= (async (): Promise<GarminStatus> => {
    try {
      if (!storedKey()) return { ...status(), error: 'noKey' }
      const offset = -new Date().getTimezoneOffset()
      const today = localDate(Date.now(), offset)
      const meta = readMeta()
      const first = addDays(today, -HISTORY_DAYS)
      const since = meta.lastSyncAt
        ? addDays(localDate(meta.lastSyncAt, offset), -OVERLAP_DAYS)
        : first
      await syncActivities(since < first ? first : since, today, await thresholdHr())
      await syncWellness(today)
      writeMeta({ ...readMeta(), lastSyncAt: Date.now(), lastOkAt: Date.now() })
      // New activities change fitness, readiness and the plan shown in the window.
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send(IPC.garminSynced)
      return status()
    } catch (e) {
      return { ...status(), ...errorCode(e) }
    } finally {
      syncing = undefined
    }
  })()
  return syncing
}

/** Sync shortly after start and then every few hours, while connected. */
export function scheduleGarminSync(): void {
  const run = (): void => {
    if (storedKey()) void syncGarmin()
  }
  setTimeout(run, 10_000)
  setInterval(run, SYNC_EVERY_MS)
}

/**
 * Sample of every known endpoint for the last week, saved to a JSON file so the fields Garmin
 * actually returns can be checked before the import is designed (E12-3/E12-5). The last group
 * probes Connect web paths for metrics the Personal API doesn't list (VO2max, readiness, status).
 */
async function saveSample(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)
  const from = addDays(today, -7)
  const yesterday = addDays(today, -1)
  const paths: Record<string, string> = {
    profileSettings: '/userprofile-service/userprofile/settings',
    dailySummaries: `/usersummary-service/v2/dailysummaries?startDate=${from}&endDate=${today}`,
    stress: `/usersummary-service/stats/stress/daily/${from}/${today}`,
    sleepSummaries: `/sleep-service/sleep/dailySleepSummariesByDate?startDate=${from}&endDate=${today}`,
    sleep: `/sleep-service/sleep/dailySleep?date=${yesterday}`,
    bodyBattery: `/wellness-service/wellness/bodyBattery/reports/daily?startDate=${from}&endDate=${today}`,
    heartRate: `/wellness-service/wellness/dailyHeartRate?date=${yesterday}`,
    hrvSummaries: `/hrv-service/hrv/daily/${from}/${today}`,
    hrv: `/hrv-service/hrv/${yesterday}`,
    heartRateZones: '/biometric-service/heartRateZones/v2',
    fitnessAge: `/fitnessage-service/fitnessage/v2/${yesterday}`,
    wellnessActivities: `/wellnessactivity-service/activity/summary/range/${from}/${today}`,
    activities: `/activitylist-service/activities/search/activities?start=0&limit=10&startDate=${from}&endDate=${today}`,
    probeVo2max: `/metrics-service/metrics/maxmet/daily/${from}/${today}`,
    probeTrainingReadiness: `/metrics-service/metrics/trainingreadiness/${yesterday}`,
    probeTrainingStatus: `/metrics-service/metrics/trainingstatus/aggregated/${yesterday}`,
  }
  const out: Record<string, unknown> = {}
  for (const [name, path] of Object.entries(paths)) {
    try {
      out[name] = { path, data: await garminGet(path) }
    } catch (e) {
      out[name] = { path, ...errorCode(e) }
    }
  }
  const file = join(app.getPath('userData'), `garmin-sample-${today}.json`)
  await writeFile(file, JSON.stringify({ fetchedAt: new Date().toISOString(), ...out }, null, 2))
  return file
}

export function registerGarminIpc(): void {
  ipcMain.handle(IPC.garminStatus, () => status())

  ipcMain.handle(IPC.garminSetKey, async (_event, key: unknown) => {
    if (typeof key !== 'string' || key.trim().length < 8 || key.length > 4096) {
      return { ...status(), error: 'invalidKey' }
    }
    if (!safeStorage.isEncryptionAvailable()) return { ...status(), error: 'encryption' }
    const k = key.trim()
    try {
      await exchange(k)
    } catch (e) {
      return { ...status(), ...errorCode(e) }
    }
    setSetting(KEY_SETTING, safeStorage.encryptString(k).toString('base64'))
    writeMeta({ hint: k.slice(-4), savedAt: Date.now(), lastOkAt: Date.now() })
    return status()
  })

  ipcMain.handle(IPC.garminClearKey, () => {
    // Disconnecting forgets the key and everything pulled with it.
    const db = getDb()
    db.prepare('delete from settings where key in (?, ?)').run(KEY_SETTING, META_SETTING)
    db.exec(`delete from external_activities where id like 'garmin:%'`)
    db.exec(`delete from external_daily where source = 'garmin'`)
    token = undefined
    return status()
  })

  ipcMain.handle(IPC.garminSync, () => syncGarmin())

  ipcMain.handle(IPC.garminTest, async () => {
    try {
      await garminGet('/userprofile-service/userprofile/settings')
      writeMeta({ ...readMeta(), lastOkAt: Date.now() })
      return status()
    } catch (e) {
      return { ...status(), ...errorCode(e) }
    }
  })

  ipcMain.handle(IPC.garminSaveSample, async () => {
    try {
      const file = await saveSample()
      shell.showItemInFolder(file)
      return { ...status(), file }
    } catch (e) {
      return { ...status(), ...errorCode(e) }
    }
  })
}
