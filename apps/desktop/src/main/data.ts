import { readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { copyFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { app, BrowserWindow, dialog, ipcMain, session } from 'electron'
import { IPC, type DataResult } from '../shared/api'
import { closeDb, getDb, MIGRATION_COUNT } from './db'
import { logLine } from './log'
import { strings } from './i18n'

// Settings → Profile → Your data (E19, DESIGN.md D32): export everything to one backup file,
// restore it, or wipe it all. A backup is a SQLite snapshot (`vacuum into`) with the user's own
// workouts (workouts.json) inside it; the service keys are left out, since they're encrypted
// for this computer only and a backup may be shared. FIT files in the rides folder are not touched.

const DB_FILE = 'cyclotron.db'
const WORKOUTS_FILE = 'workouts.json'
/** Settings that hold keys or tokens (encrypted with the OS key store). */
const SECRET_KEYS = ['garmin.apiKey', 'strava.auth', 'intervals.apiKey']
const EXT = 'cyclotron'

const userData = (): string => app.getPath('userData')
const stamp = (): string => new Date().toISOString().slice(0, 10)

async function exportData(win: BrowserWindow | null): Promise<DataResult> {
  const options = {
    title: strings().exportBackupTitle,
    defaultPath: join(app.getPath('documents'), `Cyclotron backup ${stamp()}.${EXT}`),
    filters: [{ name: strings().backupFilter, extensions: [EXT] }],
  }
  const res = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  if (res.canceled || !res.filePath) return { ok: false, cancelled: true }
  const path = res.filePath
  await rm(path, { force: true })
  getDb().prepare('vacuum into ?').run(path)
  const snap = new DatabaseSync(path)
  try {
    snap.exec('create table backup_files (name text primary key, content text not null)')
    const workouts = await readFile(join(userData(), WORKOUTS_FILE), 'utf8').catch(() => null)
    if (workouts !== null)
      snap
        .prepare('insert into backup_files (name, content) values (?, ?)')
        .run(WORKOUTS_FILE, workouts)
    snap
      .prepare(`delete from settings where key in (${SECRET_KEYS.map(() => '?').join(', ')})`)
      .run(...SECRET_KEYS)
    snap.exec('vacuum')
  } finally {
    snap.close()
  }
  logLine('main', 'info', 'data: exported a backup')
  return { ok: true, path }
}

/** Checks that a file is a Cyclotron backup this version can read. */
function checkBackup(path: string): 'notBackup' | 'tooNew' | undefined {
  let d: DatabaseSync | undefined
  try {
    d = new DatabaseSync(path, { readOnly: true })
    const tables = new Set(
      (
        d.prepare(`select name from sqlite_master where type = 'table'`).all() as { name: string }[]
      ).map((r) => r.name),
    )
    if (!tables.has('rides') || !tables.has('settings') || !tables.has('backup_files'))
      return 'notBackup'
    const v = (d.prepare('pragma user_version').get() as { user_version: number }).user_version
    return v > MIGRATION_COUNT ? 'tooNew' : undefined
  } catch {
    return 'notBackup'
  } finally {
    d?.close()
  }
}

/**
 * Removes this app's data files (the database and the user's workouts) and puts `restore` (a
 * staged database) in place. Synchronous, so no other IPC call can reopen the database meanwhile.
 */
function replaceData(restore?: { db: string; workouts?: string }): void {
  closeDb()
  const dir = userData()
  for (const name of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`, WORKOUTS_FILE])
    rmSync(join(dir, name), { force: true })
  for (const name of readdirSync(dir))
    if (/^garmin-sample-.*\.json$/.test(name)) rmSync(join(dir, name), { force: true })
  if (restore) {
    renameSync(restore.db, join(dir, DB_FILE))
    if (restore.workouts !== undefined) writeFileSync(join(dir, WORKOUTS_FILE), restore.workouts)
  }
  // Creates the database (after a wipe) or runs the migrations an older backup needs.
  getDb()
}

/** Reloads every window so the UI starts over on the new data. */
async function reloadWindows(): Promise<void> {
  // Old builds kept settings in localStorage; the renderer would move them back otherwise.
  await session.defaultSession.clearStorageData({ storages: ['localstorage'] })
  for (const w of BrowserWindow.getAllWindows()) w.webContents.reloadIgnoringCache()
}

async function importData(win: BrowserWindow | null): Promise<DataResult> {
  const options = {
    title: strings().importBackupTitle,
    defaultPath: app.getPath('documents'),
    filters: [{ name: strings().backupFilter, extensions: [EXT] }],
    properties: ['openFile' as const],
  }
  const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  const path = res.filePaths[0]
  if (res.canceled || !path) return { ok: false, cancelled: true }
  const problem = checkBackup(path)
  if (problem) return { ok: false, error: problem }
  // Prepared next to the database first: the current data goes only once the copy is ready.
  const staged = join(userData(), `${DB_FILE}.restore`)
  await copyFile(path, staged)
  let workouts: string | undefined
  const d = new DatabaseSync(staged)
  try {
    const row = d.prepare('select content from backup_files where name = ?').get(WORKOUTS_FILE) as
      { content: string } | undefined
    workouts = row?.content
    d.exec('drop table backup_files')
  } finally {
    d.close()
  }
  replaceData({ db: staged, workouts })
  logLine('main', 'info', 'data: restored a backup')
  await reloadWindows()
  return { ok: true, path }
}

async function wipeData(): Promise<DataResult> {
  replaceData()
  logLine('main', 'info', 'data: wiped')
  await reloadWindows()
  return { ok: true }
}

export function registerDataIpc(): void {
  const handle =
    (fn: (win: BrowserWindow | null) => Promise<DataResult>) =>
    async (event: Electron.IpcMainInvokeEvent): Promise<DataResult> => {
      try {
        return await fn(BrowserWindow.fromWebContents(event.sender))
      } catch (e) {
        logLine('main', 'error', `data: ${String(e)}`)
        return { ok: false, error: 'failed', detail: String(e) }
      }
    }
  ipcMain.handle(IPC.dataExport, handle(exportData))
  ipcMain.handle(IPC.dataImport, handle(importData))
  ipcMain.handle(
    IPC.dataWipe,
    handle(() => wipeData()),
  )
}
