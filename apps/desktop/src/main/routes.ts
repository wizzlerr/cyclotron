import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC, type PickedFile, type StoredRoute } from '../shared/api'
import { getDb } from './db'
import { strings } from './i18n'

// Imported routes (E13-7). The renderer parses GPX and builds routes with core; main stores the
// raw points so the route can be rebuilt the same way later.

const MAX_GPX_BYTES = 30_000_000

interface RouteRow {
  id: string
  name: string
  description: string | null
  created_at: number
  points: string
}

export function registerRoutesIpc(): void {
  ipcMain.handle(IPC.routesList, () => {
    const rows = getDb()
      .prepare('select * from routes order by created_at')
      .all() as unknown as RouteRow[]
    return rows.map((r): StoredRoute => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      createdAt: r.created_at,
      points: JSON.parse(r.points) as number[][],
    }))
  })

  ipcMain.handle(IPC.routesSave, (_event, route: StoredRoute) => {
    if (typeof route?.id !== 'string' || !Array.isArray(route.points)) return
    getDb()
      .prepare(
        `insert or replace into routes (id, name, description, created_at, points)
         values (?, ?, ?, ?, ?)`,
      )
      .run(
        route.id,
        String(route.name).slice(0, 200),
        route.description ?? null,
        route.createdAt,
        JSON.stringify(route.points),
      )
  })

  ipcMain.handle(IPC.routesRemove, (_event, id: string) => {
    getDb().prepare('delete from routes where id = ?').run(id)
  })

  ipcMain.handle(IPC.routesPickGpx, async (event): Promise<PickedFile[]> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: strings().importGpxTitle,
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: strings().gpxFilter, extensions: ['gpx'] }],
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled) return []
    const files: PickedFile[] = []
    for (const path of result.filePaths) {
      const text = await readFile(path, 'utf8')
      if (text.length <= MAX_GPX_BYTES) files.push({ name: basename(path), text })
    }
    return files
  })
}
