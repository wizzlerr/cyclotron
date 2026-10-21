import { ipcMain, powerSaveBlocker } from 'electron'
import { IPC } from '../shared/api'

let blocker: number | undefined

// E3-7: keep the display (and so the PC) awake while a ride is running.
export function registerRideIpc(): void {
  ipcMain.handle(IPC.rideKeepAwake, (_event, on: boolean) => {
    if (on && blocker === undefined) {
      blocker = powerSaveBlocker.start('prevent-display-sleep')
    } else if (!on && blocker !== undefined) {
      powerSaveBlocker.stop(blocker)
      blocker = undefined
    }
  })
}
