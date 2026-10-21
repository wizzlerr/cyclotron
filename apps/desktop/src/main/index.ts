import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { IPC } from '../shared/api'
import { attachBluetooth, registerBluetoothIpc } from './bluetooth'
import { closeDb } from './db'
import { registerPrefsIpc } from './prefs'
import { registerRideIpc } from './ride'
import { registerRidesIpc } from './rides'
import { registerRoutesIpc } from './routes'
import { registerSpikeIpc } from './spike'
import { registerWorkoutsIpc } from './workouts'
import { setupUserData } from './user-data'

setupUserData()

// One instance only: two would fight over the trainer and the database.
if (!app.requestSingleInstanceLock()) app.exit(0)
app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win?.isMinimized()) win.restore()
  win?.focus()
})

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#111418',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // A ride must keep ticking when the window is minimized or covered (DESIGN.md §4.1).
      backgroundThrottling: false,
    },
  })

  win.once('ready-to-show', () => win.show())
  attachBluetooth(win)

  // No in-app navigation or popups: open external links in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event) => event.preventDefault())

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle(IPC.appGetVersion, () => app.getVersion())
ipcMain.handle(IPC.appShowDataFolder, async () => {
  await shell.openPath(app.getPath('userData'))
})
registerPrefsIpc()
registerBluetoothIpc()
registerSpikeIpc()
registerRideIpc()
registerWorkoutsIpc()
registerRidesIpc()
registerRoutesIpc()

void app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => closeDb())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
