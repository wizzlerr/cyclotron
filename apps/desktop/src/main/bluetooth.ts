import { app, ipcMain, type BrowserWindow } from 'electron'
import { IPC, type BluetoothDeviceInfo } from '../shared/api'

// Electron has no built-in Web Bluetooth chooser: `requestDevice()` in the renderer fires
// `select-bluetooth-device` here (repeatedly, as scan results arrive). We forward the list to
// the UI and complete the request when the user picks a device (DESIGN.md §4.2).

let pending: ((deviceId: string) => void) | undefined
let preferred: string | null = null
/** Address (Electron's device id) of the last picked device, so the UI can tell twin units apart. */
let lastPicked: string | null = null

function finish(deviceId: string): void {
  const callback = pending
  pending = undefined
  if (deviceId) lastPicked = deviceId
  callback?.(deviceId)
}

/**
 * Chromium ships Web Bluetooth enabled on Windows and macOS only; on Linux `navigator.bluetooth`
 * doesn't exist without this Blink feature (checked with Electron 44). It talks to BlueZ over
 * D-Bus. Must run before the app is ready.
 */
export function enableWebBluetooth(): void {
  if (process.platform === 'linux')
    app.commandLine.appendSwitch('enable-blink-features', 'WebBluetooth')
}

export function registerBluetoothIpc(): void {
  ipcMain.handle(IPC.btSelect, (_event, id: string) => finish(id))
  // An empty id rejects requestDevice() with NotFoundError.
  ipcMain.handle(IPC.btCancel, () => finish(''))
  ipcMain.handle(IPC.btPrefer, (_event, nameOrAddress: string | null) => {
    preferred = nameOrAddress
    lastPicked = null
  })
  ipcMain.handle(IPC.btLastPicked, () => lastPicked)
}

export function attachBluetooth(win: BrowserWindow): void {
  win.webContents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault()
    pending = callback
    const match =
      preferred && devices.find((d) => d.deviceId === preferred || d.deviceName === preferred)
    if (match) {
      preferred = null
      finish(match.deviceId)
      return
    }
    const list: BluetoothDeviceInfo[] = devices.map((d) => ({ id: d.deviceId, name: d.deviceName }))
    win.webContents.send(IPC.btDeviceList, list)
  })
}
