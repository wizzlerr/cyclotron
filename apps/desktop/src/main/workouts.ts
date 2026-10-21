import { readFile, rename, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC, type PickedFile } from '../shared/api'

// The user's workout library (imported and, later, custom workouts) lives in
// <userData>/workouts.json (DESIGN.md §6.1). Built-ins ship with the app and aren't stored.
const libraryPath = (): string => join(app.getPath('userData'), 'workouts.json')
const MAX_ZWO_BYTES = 1_000_000

export function registerWorkoutsIpc(): void {
  ipcMain.handle(IPC.workoutsLoad, async () => {
    try {
      return await readFile(libraryPath(), 'utf8')
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw e
    }
  })

  ipcMain.handle(IPC.workoutsSave, async (_event, json: string) => {
    // Write then rename, so a crash mid-write can't leave a half-written library.
    const tmp = `${libraryPath()}.tmp`
    await writeFile(tmp, json, 'utf8')
    await rename(tmp, libraryPath())
  })

  ipcMain.handle(IPC.workoutsPickZwo, async (event): Promise<PickedFile[]> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Import Zwift workouts',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Zwift workouts', extensions: ['zwo'] }],
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled) return []
    const files: PickedFile[] = []
    for (const path of result.filePaths) {
      const text = await readFile(path, 'utf8')
      if (text.length <= MAX_ZWO_BYTES) files.push({ name: basename(path), text })
    }
    return files
  })
}
