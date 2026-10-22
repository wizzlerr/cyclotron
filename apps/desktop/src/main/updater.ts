import { app, BrowserWindow, ipcMain, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { IPC, type UpdateStatus } from '../shared/api'
import { getSetting, setSetting } from './db'
import { logLine } from './log'

// Auto-update from GitHub Releases (E7-5). Windows: downloads in the background and installs on
// restart. macOS: the app isn't signed, and Squirrel.Mac only installs signed updates, so it only
// says a new version exists and links to the release page. Development builds never check.

const { autoUpdater } = electronUpdater
const RELEASES_URL = 'https://github.com/wizzlerr/cyclotron/releases/latest'
const AUTO_KEY = 'updates.auto'
const EVERY_MS = 6 * 3600_000

let state: UpdateStatus = { state: 'idle', current: '' }
const canInstall = process.platform === 'win32'

function set(next: Partial<UpdateStatus>): void {
  state = { ...state, ...next, current: app.getVersion(), auto: autoEnabled() }
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(IPC.updateChanged, state)
}

const autoEnabled = (): boolean => getSetting(AUTO_KEY) !== '0'

async function check(): Promise<UpdateStatus> {
  if (!app.isPackaged) {
    set({ state: 'dev' })
    return state
  }
  try {
    set({ state: 'checking', error: undefined })
    await autoUpdater.checkForUpdates()
  } catch (e) {
    set({ state: 'error', error: e instanceof Error ? e.message : String(e) })
    logLine('main', 'warn', `update check failed: ${String(e)}`)
  }
  return state
}

export function setupUpdater(): void {
  state = { state: app.isPackaged ? 'idle' : 'dev', current: app.getVersion(), auto: autoEnabled() }
  autoUpdater.autoDownload = canInstall
  autoUpdater.autoInstallOnAppQuit = canInstall
  autoUpdater.logger = {
    info: (m: unknown) => logLine('updater', 'info', String(m)),
    warn: (m: unknown) => logLine('updater', 'warn', String(m)),
    error: (m: unknown) => logLine('updater', 'error', String(m)),
    debug: () => {},
  }
  autoUpdater.on('update-available', (info) =>
    set({ state: canInstall ? 'downloading' : 'available', version: info.version }),
  )
  autoUpdater.on('update-not-available', () => set({ state: 'latest' }))
  autoUpdater.on('download-progress', (p) =>
    set({ state: 'downloading', percent: Math.round(p.percent) }),
  )
  autoUpdater.on('update-downloaded', (info) => set({ state: 'ready', version: info.version }))
  autoUpdater.on('error', (e) => set({ state: 'error', error: e.message }))

  if (app.isPackaged && autoEnabled()) {
    setTimeout(() => void check(), 30_000)
    setInterval(() => autoEnabled() && void check(), EVERY_MS)
  }

  ipcMain.handle(IPC.updateStatus, () => state)
  ipcMain.handle(IPC.updateCheck, () => check())
  ipcMain.handle(IPC.updateSetAuto, (_event, on: unknown) => {
    setSetting(AUTO_KEY, on === false ? '0' : '1')
    set({})
    return state
  })
  ipcMain.handle(IPC.updateInstall, () => {
    if (state.state === 'ready') autoUpdater.quitAndInstall()
    else void shell.openExternal(RELEASES_URL)
  })
}
