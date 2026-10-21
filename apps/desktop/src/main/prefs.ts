import { ipcMain } from 'electron'
import { IPC } from '../shared/api'
import { getSetting, setSetting } from './db'

// Renderer settings live in the SQLite `settings` table under a `pref:` prefix.
const PREFIX = 'pref:'

function validKey(key: unknown): key is string {
  return typeof key === 'string' && /^cyclotron\.[\w.]{1,64}$/.test(key)
}

export function registerPrefsIpc(): void {
  ipcMain.on(IPC.prefsGet, (event, key: unknown) => {
    event.returnValue = validKey(key) ? (getSetting(PREFIX + key) ?? null) : null
  })
  ipcMain.on(IPC.prefsSet, (_event, key: unknown, value: unknown) => {
    if (validKey(key) && typeof value === 'string' && value.length < 100_000) {
      setSetting(PREFIX + key, value)
    }
  })
}
