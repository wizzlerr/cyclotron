import { ipcMain, type BrowserWindow } from 'electron'
import { IPC, type BluetoothDeviceInfo } from '../shared/api'

// Electron has no built-in Web Bluetooth chooser: `requestDevice()` in the renderer fires
// `select-bluetooth-device` here (repeatedly, as scan results arrive). We forward the list to
// the UI and complete the request when the user picks a device (DESIGN.md §4.2).

let pending: ((deviceId: string) => void) | undefined
let preferredName: string | null = null

function finish(deviceId: string): void {
  const callback = pending
  pending = undefined
  callback?.(deviceId)
}

export function registerBluetoothIpc(): void {
  ipcMain.handle(IPC.btSelect, (_event, id: string) => finish(id))
  // An empty id rejects requestDevice() with NotFoundError.
  ipcMain.handle(IPC.btCancel, () => finish(''))
  ipcMain.handle(IPC.btPrefer, (_event, name: string | null) => {
    preferredName = name
  })
}

export function attachBluetooth(win: BrowserWindow): void {
  win.webContents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault()
    pending = callback
    const preferred = preferredName && devices.find((d) => d.deviceName === preferredName)
    if (preferred) {
      preferredName = null
      finish(preferred.deviceId)
      return
    }
    const list: BluetoothDeviceInfo[] = devices.map((d) => ({ id: d.deviceId, name: d.deviceName }))
    win.webContents.send(IPC.btDeviceList, list)
  })
}
