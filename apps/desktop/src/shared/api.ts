import type { RideSample } from '@cyclotron/core'

export type { RideSample }

export interface RideStartInfo {
  /** ms since the Unix epoch. */
  startedAt: number
  /** Local time minus UTC, minutes. */
  utcOffsetMin: number
  workoutId: string
  workoutName: string
  ftpW: number
}

/** Ride totals stored with the ride row (computed in the renderer by core). */
export interface RideTotals {
  durationS: number
  timerS: number
  avgPowerW: number
  npW: number
  intensity: number
  tss: number
  kj: number
  avgHrBpm?: number
  maxHrBpm?: number
  distanceM: number
}

export type RideFeedback = 'easy' | 'right' | 'hard' | 'failed'

export interface StoredRide extends RideStartInfo {
  id: number
  status: 'active' | 'finished'
  endedAt?: number
  totals?: RideTotals
  feedback?: RideFeedback
  fitPath?: string
}

export type FtpSource = 'manual' | 'ramp' | '20min' | 'estimate'

export interface FtpEntry {
  /** ms since epoch. */
  date: number
  ftpW: number
  source: FtpSource
  rideId?: number
}

export interface PickedFile {
  name: string
  text: string
}

export interface BluetoothDeviceInfo {
  id: string
  name: string
}

/** The only API the renderer can call (exposed by the preload as `window.cyclotron`). */
export interface CyclotronApi {
  app: {
    getVersion(): Promise<string>
  }
  bluetooth: {
    /** Scan results while `navigator.bluetooth.requestDevice()` is pending. Returns an unsubscribe function. */
    onDeviceList(listener: (devices: BluetoothDeviceInfo[]) => void): () => void
    /** Completes the pending `requestDevice()` with this device. */
    selectDevice(id: string): Promise<void>
    /** Rejects the pending `requestDevice()` (NotFoundError). */
    cancelSelection(): Promise<void>
    /** Picks the device with this name as soon as a scan finds it (remembered devices). */
    preferDevice(name: string | null): Promise<void>
  }
  ride: {
    /** Prevents display sleep while a ride runs (E3-7). */
    keepAwake(on: boolean): Promise<void>
  }
  workouts: {
    /** The saved library JSON, or null if there is none yet. */
    load(): Promise<string | null>
    save(json: string): Promise<void>
    /** Asks for .zwo files and returns their contents; empty if cancelled. */
    pickZwo(): Promise<PickedFile[]>
  }
  rides: {
    /** Creates the ride row; returns its id. */
    start(info: RideStartInfo): Promise<number>
    /** Adds samples (inserting again for the same `t` replaces the sample). */
    appendSamples(rideId: number, samples: RideSample[]): Promise<void>
    /** Saves the FIT file to the ride folder and marks the ride finished. */
    finish(
      rideId: number,
      totals: RideTotals,
      fit: { fileName: string; bytes: Uint8Array },
    ): Promise<{ fitPath: string | null; fitError?: string }>
    /** The newest ride that was never finished (e.g. the app crashed), with its samples. */
    unfinished(): Promise<{ ride: StoredRide; samples: RideSample[] } | null>
    /** Deletes the ride, its samples and its FIT file. */
    discard(rideId: number): Promise<void>
    setFeedback(rideId: number, feedback: RideFeedback): Promise<void>
    list(limit: number): Promise<StoredRide[]>
    showFit(rideId: number): Promise<void>
    fitFolder(): Promise<string>
    /** Asks for a new FIT folder; returns it, or null if cancelled. */
    chooseFitFolder(): Promise<string | null>
  }
  ftp: {
    /** Newest first. */
    history(limit: number): Promise<FtpEntry[]>
    record(entry: FtpEntry): Promise<void>
  }
  spike: {
    /** Asks where to save a BLE capture; returns the path, or null if cancelled. */
    saveCapture(json: string): Promise<string | null>
  }
}

/** IPC channel names shared by main and preload. */
export const IPC = {
  appGetVersion: 'app:getVersion',
  btDeviceList: 'bt:deviceList',
  btSelect: 'bt:select',
  btCancel: 'bt:cancel',
  btPrefer: 'bt:prefer',
  rideKeepAwake: 'ride:keepAwake',
  workoutsLoad: 'workouts:load',
  workoutsSave: 'workouts:save',
  workoutsPickZwo: 'workouts:pickZwo',
  ridesStart: 'rides:start',
  ridesAppend: 'rides:append',
  ridesFinish: 'rides:finish',
  ridesUnfinished: 'rides:unfinished',
  ridesDiscard: 'rides:discard',
  ridesFeedback: 'rides:feedback',
  ridesList: 'rides:list',
  ridesShowFit: 'rides:showFit',
  ridesFitFolder: 'rides:fitFolder',
  ridesChooseFitFolder: 'rides:chooseFitFolder',
  ftpHistory: 'ftp:history',
  ftpRecord: 'ftp:record',
  spikeSaveCapture: 'spike:saveCapture',
} as const
