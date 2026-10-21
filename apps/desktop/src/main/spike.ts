import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, dialog, ipcMain, shell, BrowserWindow } from 'electron'
import { IPC } from '../shared/api'

// E1-0 spike: save a BLE capture (services, reads, packet log) as JSON for later test fixtures.
export function registerSpikeIpc(): void {
  ipcMain.handle(IPC.spikeSaveCapture, async (event, json: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const options = {
      defaultPath: join(app.getPath('documents'), `cyclotron-capture-${stamp}.json`),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    }
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, json, 'utf8')
    shell.showItemInFolder(result.filePath)
    return result.filePath
  })
}
