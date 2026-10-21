import type { FtpSource } from '../../shared/api'
import { loadPref, savePref } from './lib/prefs'

const KEY = 'cyclotron.profile'
const DEFAULT_FTP_W = 200

interface Stored {
  ftpW?: number
  weightKg?: number
  maxHr?: number
}

const stored = loadPref<Stored>(KEY) ?? {}

/** Rider profile. */
class Profile {
  ftpW = $state(stored.ftpW ?? DEFAULT_FTP_W)
  /** For W/kg (E4-3) and, later, route physics (E13). */
  weightKg = $state<number | undefined>(stored.weightKg)
  /** For heart rate zones (E4-2). */
  maxHr = $state<number | undefined>(stored.maxHr)
  /** Bumped when an FTP is recorded, so the history list reloads. */
  ftpVersion = $state(0)

  /** Sets the FTP and logs it in the FTP history (E6-3). */
  setFtp(watts: number, source: FtpSource = 'manual', rideId?: number): void {
    if (!Number.isFinite(watts) || watts < 50 || watts > 600) return
    this.ftpW = Math.round(watts)
    this.save()
    void window.cyclotron.ftp
      .record({ date: Date.now(), ftpW: this.ftpW, source, rideId })
      .then(() => this.ftpVersion++)
  }

  /** NaN (an emptied field) clears the value. */
  setWeight(kg: number): void {
    if (Number.isNaN(kg)) this.weightKg = undefined
    else if (kg >= 30 && kg <= 200) this.weightKg = Math.round(kg * 10) / 10
    else return
    this.save()
  }

  setMaxHr(bpm: number): void {
    if (Number.isNaN(bpm)) this.maxHr = undefined
    else if (bpm >= 120 && bpm <= 230) this.maxHr = Math.round(bpm)
    else return
    this.save()
  }

  private save(): void {
    const value: Stored = { ftpW: this.ftpW, weightKg: this.weightKg, maxHr: this.maxHr }
    savePref(KEY, value)
  }
}

export const profile = new Profile()
