import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { release, type as osType } from 'node:os'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { IPC, type DiagnosticInput } from '../shared/api'
import { strings } from './i18n'

// Diagnostics: a log file in <userData>/logs (main and renderer warnings/errors, crashes,
// Bluetooth events) and a "Save diagnostic report" that bundles it with the renderer's recent
// Bluetooth trace, so riders can send something useful when a trainer misbehaves.

const MAX_BYTES = 2_000_000
const TAIL_LINES = 1500
const ISSUES_URL = 'https://github.com/wizzlerr/cyclotron/issues/new'

const logDir = (): string => join(app.getPath('userData'), 'logs')
const logFile = (): string => join(logDir(), 'cyclotron.log')

/** Appends one line; rotates to cyclotron.1.log past MAX_BYTES. Never throws. */
export function logLine(source: string, level: string, message: string): void {
  try {
    if (!existsSync(logDir())) mkdirSync(logDir(), { recursive: true })
    const file = logFile()
    if (existsSync(file) && statSync(file).size > MAX_BYTES) {
      renameSync(file, join(logDir(), 'cyclotron.1.log'))
    }
    const text = message.replace(/\s+$/, '').replace(/\n/g, '\n    ')
    appendFileSync(file, `${new Date().toISOString()} ${level.padEnd(5)} [${source}] ${text}\n`)
  } catch {
    // Logging must never break the app.
  }
}

/** Main's own warnings and errors, and crashes, go to the log too. */
export function initLog(): void {
  for (const level of ['warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      logLine('main', level, args.map(format).join(' '))
    }
  }
  process.on('uncaughtException', (e) => logLine('main', 'fatal', format(e)))
  process.on('unhandledRejection', (e) => logLine('main', 'error', `unhandled: ${format(e)}`))
  logLine('main', 'info', `Cyclotron ${app.getVersion()} starting on ${osType()} ${release()}`)
}

/** The renderer's warnings and errors (console) end up in the log as well. */
export function attachRendererLog(win: BrowserWindow): void {
  win.webContents.on('console-message', (event: unknown, ...rest: unknown[]) => {
    // Electron passes an event object with level/message (newer) or positional args (older).
    const e = event as { level?: unknown; message?: unknown }
    const level = String(e.level ?? rest[0] ?? '')
    const message = String(e.message ?? rest[1] ?? '')
    if (/warn|error|^2$|^3$/.test(level)) {
      logLine('renderer', /error|^3$/.test(level) ? 'error' : 'warn', message)
    }
  })
  win.webContents.on('render-process-gone', (_e, details) =>
    logLine('main', 'fatal', `renderer gone: ${details.reason} (${details.exitCode})`),
  )
}

function format(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}${v.stack ? `\n${v.stack}` : ''}`
  return typeof v === 'string' ? v : JSON.stringify(v)
}

function logTail(): string[] {
  try {
    const lines = readFileSync(logFile(), 'utf8').split('\n').filter(Boolean)
    return lines.slice(-TAIL_LINES)
  } catch {
    return []
  }
}

export function registerLogIpc(): void {
  ipcMain.on(IPC.diagLog, (_event, level: unknown, message: unknown) => {
    if (typeof message === 'string' && message.length < 10_000) {
      logLine('renderer', typeof level === 'string' ? level.slice(0, 5) : 'info', message)
    }
  })

  ipcMain.handle(IPC.diagSave, async (event, input: DiagnosticInput): Promise<string | null> => {
    const report = {
      createdAt: new Date().toISOString(),
      app: { version: app.getVersion(), packaged: app.isPackaged },
      system: {
        os: `${osType()} ${release()}`,
        platform: process.platform,
        arch: process.arch,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        locale: app.getLocale(),
      },
      ...input,
      log: logTail(),
    }
    const name = `cyclotron-diagnostics-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
    const options: Electron.SaveDialogOptions = {
      title: strings().saveDiagnosticsTitle,
      defaultPath: join(app.getPath('documents'), name),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    }
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, JSON.stringify(report, null, 2), 'utf8')
    shell.showItemInFolder(result.filePath)
    return result.filePath
  })

  ipcMain.handle(IPC.diagOpenLogs, async () => {
    if (!existsSync(logDir())) mkdirSync(logDir(), { recursive: true })
    await shell.openPath(logDir())
  })

  ipcMain.handle(IPC.diagReportIssue, () => shell.openExternal(ISSUES_URL))
}
