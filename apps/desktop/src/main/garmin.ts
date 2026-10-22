import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { addDays } from '@cyclotron/core'
import { app, ipcMain, safeStorage, shell } from 'electron'
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
}

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
    encryption: safeStorage.isEncryptionAvailable(),
  }
}

const errorCode = (e: unknown): { error: GarminError['code']; status?: number } =>
  e instanceof GarminError ? { error: e.code, status: e.status } : { error: 'network' }

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
    getDb().prepare('delete from settings where key in (?, ?)').run(KEY_SETTING, META_SETTING)
    token = undefined
    return status()
  })

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
