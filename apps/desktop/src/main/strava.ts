import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { basename } from 'node:path'
import { ipcMain, safeStorage, shell } from 'electron'
import { IPC, type StravaStatus } from '../shared/api'
import { getDb, getSetting, setSetting } from './db'
import { logLine } from './log'

// Strava upload (E12-7, optional). Each rider registers their own Strava API app (Settings → My
// API Application, callback domain "localhost") and pastes its Client ID and Secret, so this
// open-source app never ships a secret. Strava doesn't forward rides to Garmin (DESIGN.md §9).
// Secret and tokens are encrypted with the OS key store and stay in main.

const AUTH_URL = 'https://www.strava.com/oauth/authorize'
const TOKEN_URL = 'https://www.strava.com/oauth/token'
const UPLOAD_URL = 'https://www.strava.com/api/v3/uploads'
const ACTIVITY_URL = 'https://www.strava.com/activities/'
const KEY = 'strava.auth'
const AUTO_KEY = 'strava.auto'
const CONNECT_TIMEOUT_MS = 5 * 60_000
const POLL_MS = 2000
const POLL_TRIES = 20

interface Auth {
  clientId: string
  clientSecret: string
  accessToken?: string
  refreshToken?: string
  /** Seconds since the epoch. */
  expiresAt?: number
  athlete?: string
}

export class StravaError extends Error {
  constructor(
    readonly code:
      | 'noApp'
      | 'notConnected'
      | 'denied'
      | 'timeout'
      | 'network'
      | 'http'
      | 'encryption'
      | 'noFit'
      | 'rejected',
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code)
  }
}

function readAuth(): Auth | undefined {
  const enc = getSetting(KEY)
  if (!enc || !safeStorage.isEncryptionAvailable()) return undefined
  try {
    return JSON.parse(safeStorage.decryptString(Buffer.from(enc, 'base64'))) as Auth
  } catch {
    return undefined
  }
}

function writeAuth(auth: Auth): void {
  if (!safeStorage.isEncryptionAvailable()) throw new StravaError('encryption')
  setSetting(KEY, safeStorage.encryptString(JSON.stringify(auth)).toString('base64'))
}

function status(): StravaStatus {
  const a = readAuth()
  return {
    hasApp: !!a?.clientId,
    clientId: a?.clientId,
    connected: !!a?.refreshToken,
    athlete: a?.athlete,
    auto: getSetting(AUTO_KEY) === '1',
    encryption: safeStorage.isEncryptionAvailable(),
  }
}

async function tokenRequest(body: Record<string, string>): Promise<Record<string, unknown>> {
  let res: Response
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new StravaError('network')
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (res.status === 400 || res.status === 401)
    throw new StravaError('denied', JSON.stringify(json))
  if (!res.ok) throw new StravaError('http', String(res.status))
  return json
}

function saveTokens(auth: Auth, json: Record<string, unknown>): Auth {
  const athlete = json['athlete'] as { firstname?: string; lastname?: string } | undefined
  const next: Auth = {
    ...auth,
    accessToken: String(json['access_token']),
    refreshToken: String(json['refresh_token']),
    expiresAt: Number(json['expires_at']),
    athlete: athlete ? `${athlete.firstname ?? ''} ${athlete.lastname ?? ''}`.trim() : auth.athlete,
  }
  writeAuth(next)
  return next
}

/** A valid access token, refreshed when it's about to expire. */
async function accessToken(): Promise<string> {
  let auth = readAuth()
  if (!auth?.clientId) throw new StravaError('noApp')
  if (!auth.refreshToken) throw new StravaError('notConnected')
  if (!auth.accessToken || (auth.expiresAt ?? 0) - Date.now() / 1000 < 120) {
    auth = saveTokens(
      auth,
      await tokenRequest({
        client_id: auth.clientId,
        client_secret: auth.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: auth.refreshToken,
      }),
    )
  }
  return auth.accessToken!
}

let pendingConnect: Server | undefined

/**
 * OAuth in the system browser: a one-off local server catches Strava's redirect (the rider's app
 * must have "localhost" as its callback domain).
 */
async function connect(): Promise<void> {
  const auth = readAuth()
  if (!auth?.clientId) throw new StravaError('noApp')
  pendingConnect?.close()
  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (url.pathname !== '/strava') {
        res.writeHead(404).end()
        return
      }
      const c = url.searchParams.get('code')
      const scope = url.searchParams.get('scope') ?? ''
      const ok = !!c && scope.includes('activity:write')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        `<!doctype html><meta charset="utf-8"><title>Cyclotron</title><body style="font:16px system-ui;padding:2rem">${
          ok
            ? 'Cyclotron is connected to Strava. You can close this tab.'
            : 'Strava access was not granted (Cyclotron needs permission to upload activities). You can close this tab.'
        }</body>`,
      )
      clearTimeout(timer)
      server.close()
      pendingConnect = undefined
      if (ok) resolve(c!)
      else reject(new StravaError('denied'))
    })
    const timer = setTimeout(() => {
      server.close()
      pendingConnect = undefined
      reject(new StravaError('timeout'))
    }, CONNECT_TIMEOUT_MS)
    pendingConnect = server
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port
      const url = new URL(AUTH_URL)
      url.searchParams.set('client_id', auth.clientId)
      url.searchParams.set('redirect_uri', `http://localhost:${port}/strava`)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('approval_prompt', 'auto')
      url.searchParams.set('scope', 'activity:write')
      void shell.openExternal(url.toString())
    })
  })
  saveTokens(
    auth,
    await tokenRequest({
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  )
}

/** Uploads a ride's FIT file; returns the Strava activity id. Remembers it on the ride. */
export async function uploadRide(rideId: number): Promise<number> {
  const db = getDb()
  const row = db
    .prepare('select fit_path, workout_name, strava_id from rides where id = ?')
    .get(rideId) as
    { fit_path: string | null; workout_name: string; strava_id: number | null } | undefined
  if (row?.strava_id) return row.strava_id
  if (!row?.fit_path) throw new StravaError('noFit')
  const token = await accessToken()
  const form = new FormData()
  form.set('file', new Blob([await readFile(row.fit_path)]), basename(row.fit_path))
  form.set('data_type', 'fit')
  form.set('name', row.workout_name)
  form.set('external_id', `cyclotron-${rideId}-${basename(row.fit_path)}`)
  let res: Response
  try {
    res = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    })
  } catch {
    throw new StravaError('network')
  }
  if (res.status === 401) throw new StravaError('denied')
  if (!res.ok) throw new StravaError('http', String(res.status))
  let upload = (await res.json()) as {
    id: number
    activity_id?: number | null
    error?: string | null
  }
  // Strava processes uploads in the background: poll until there's an activity (or an error).
  for (let i = 0; i < POLL_TRIES && !upload.activity_id && !upload.error; i++) {
    await new Promise((r) => setTimeout(r, POLL_MS))
    const poll = await fetch(`${UPLOAD_URL}/${upload.id}`, {
      headers: { Authorization: `Bearer ${await accessToken()}` },
      signal: AbortSignal.timeout(30_000),
    }).catch(() => undefined)
    if (poll?.ok) upload = (await poll.json()) as typeof upload
  }
  // Already on Strava (e.g. uploaded by hand): take that activity.
  const duplicate = /duplicate of .*?(\d{6,})/i.exec(upload.error ?? '')
  const activityId = upload.activity_id ?? (duplicate ? Number(duplicate[1]) : undefined)
  if (!activityId) throw new StravaError('rejected', upload.error ?? 'still processing')
  db.prepare('update rides set strava_id = ? where id = ?').run(activityId, rideId)
  return activityId
}

/** After a ride is saved: upload it when the rider turned that on (failures only go to the log). */
export function autoUpload(rideId: number): void {
  if (getSetting(AUTO_KEY) !== '1' || !readAuth()?.refreshToken) return
  uploadRide(rideId).then(
    (id) => logLine('main', 'info', `strava: ride ${rideId} uploaded as ${id}`),
    (e: unknown) =>
      logLine('main', 'warn', `strava: auto-upload of ride ${rideId} failed: ${String(e)}`),
  )
}

const errorOf = (e: unknown): Pick<StravaStatus, 'error' | 'detail'> =>
  e instanceof StravaError
    ? { error: e.code, detail: e.message }
    : { error: 'network', detail: String(e) }

export function registerStravaIpc(): void {
  ipcMain.handle(IPC.stravaStatus, () => status())

  ipcMain.handle(IPC.stravaSetApp, (_event, clientId: unknown, clientSecret: unknown) => {
    if (
      typeof clientId !== 'string' ||
      !/^\d{1,12}$/.test(clientId.trim()) ||
      typeof clientSecret !== 'string' ||
      clientSecret.trim().length < 10 ||
      clientSecret.length > 200
    ) {
      return { ...status(), error: 'noApp' }
    }
    try {
      writeAuth({ clientId: clientId.trim(), clientSecret: clientSecret.trim() })
      return status()
    } catch (e) {
      return { ...status(), ...errorOf(e) }
    }
  })

  ipcMain.handle(IPC.stravaConnect, async () => {
    try {
      await connect()
      return status()
    } catch (e) {
      return { ...status(), ...errorOf(e) }
    }
  })

  ipcMain.handle(IPC.stravaDisconnect, () => {
    getDb().prepare('delete from settings where key in (?, ?)').run(KEY, AUTO_KEY)
    return status()
  })

  ipcMain.handle(IPC.stravaSetAuto, (_event, on: unknown) => {
    setSetting(AUTO_KEY, on === true ? '1' : '0')
    return status()
  })

  ipcMain.handle(IPC.stravaUpload, async (_event, rideId: number) => {
    try {
      const id = await uploadRide(rideId)
      return { ...status(), activityUrl: `${ACTIVITY_URL}${id}` }
    } catch (e) {
      return { ...status(), ...errorOf(e) }
    }
  })

  ipcMain.handle(IPC.stravaOpenActivity, (_event, id: unknown) => {
    if (typeof id === 'number' && Number.isInteger(id))
      void shell.openExternal(`${ACTIVITY_URL}${id}`)
  })
}
