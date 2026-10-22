import { devices } from '../devices/devices.svelte'
import { FtmsTrainer } from '../devices/ftms-trainer'
import { i18n } from '../i18n/i18n.svelte'
import { nav } from '../nav.svelte'
import { profile } from '../profile.svelte'
import { ride } from '../ride/session.svelte'
import { bleTrace } from './diag'

// Builds and saves a diagnostic report (Settings → Problem?). Holds no keys or tokens: the Garmin
// key and Strava tokens live only in main, encrypted, and aren't part of this.

export async function saveDiagnosticReport(): Promise<string | null> {
  const t = devices.trainer
  return window.cyclotron.diag.saveReport({
    devices: {
      trainer: t && {
        kind: t.kind,
        name: t.name,
        capabilities: t.capabilities(),
        ftmsFeatures: t instanceof FtmsTrainer ? t.features : undefined,
        resistanceRange: t instanceof FtmsTrainer ? t.resistanceRange : undefined,
        status: devices.trainerStatus,
        lastData: devices.data,
        control: devices.control,
      },
      heartRate: devices.heartRate && { name: devices.heartRate.name, bpm: devices.bpm },
      remembered: devices.remembered,
      lastError: devices.error,
    },
    settings: {
      language: i18n.lang,
      ftpW: profile.ftpW,
      weightKg: profile.weightKg,
      maxHr: profile.maxHr,
      trainerDifficulty: profile.difficulty,
      goal: profile.goal,
      weeklyHours: profile.weeklyHours,
    },
    bleTrace: bleTrace(),
    context: {
      screen: nav.screen,
      ride: ride.workout && {
        workout: ride.workout.id,
        route: ride.route?.id,
        status: ride.state?.status,
        positionS: ride.state?.positionS,
        error: ride.error?.(),
        notice: ride.notice?.(),
      },
    },
  })
}
