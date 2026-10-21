import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/**
 * Names the app "Cyclotron" and keeps its data in `<appData>/Cyclotron` in dev and installed
 * builds alike. Builds before E7 used the package name, `<appData>/@cyclotron/desktop`; that
 * folder is moved once. Must run before anything touches `userData`.
 */
export function setupUserData(): void {
  app.setName('Cyclotron')
  // An explicit --user-data-dir (test runs) wins.
  if (app.commandLine.hasSwitch('user-data-dir')) return
  const appData = app.getPath('appData')
  const userData = join(appData, 'Cyclotron')
  const legacy = join(appData, '@cyclotron', 'desktop')
  if (!existsSync(userData) && existsSync(legacy)) {
    try {
      renameSync(legacy, userData)
    } catch (e) {
      // Probably still open in another instance: use it where it is and try again next start.
      console.error('moving app data failed', e)
      app.setPath('userData', legacy)
      return
    }
  }
  app.setPath('userData', userData)
}
