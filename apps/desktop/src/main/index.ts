import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { IPC } from '../shared/api'
import { attachBluetooth, registerBluetoothIpc } from './bluetooth'
import { registerRideIpc } from './ride'
import { registerSpikeIpc } from './spike'
import { registerWorkoutsIpc } from './workouts'

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
registerBluetoothIpc()
registerSpikeIpc()
registerRideIpc()
registerWorkoutsIpc()

void app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
