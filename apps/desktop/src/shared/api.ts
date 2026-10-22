import type { DailyLoad, PowerCurvePoint, RideSample } from '@cyclotron/core'

export type { DailyLoad, PowerCurvePoint, RideSample }

export interface RideStartInfo {
  /** ms since the Unix epoch. */
  startedAt: number
  /** Local time minus UTC, minutes. */
  utcOffsetMin: number
  workoutId: string
  workoutName: string
  ftpW: number
  /** Set for rides along a route (E13). */
  routeId?: string
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
  /** 'import' for rides brought in from FIT files (E9-5). */
  source: 'recorded' | 'import'
}

/** One ride with everything the detail view needs (E9-1). */
export interface RideDetail {
  ride: StoredRide
  samples: RideSample[]
  curve: PowerCurvePoint[]
  /** Seconds in power zones Z1…Z7. */
  zones: number[]
}

/** Best power for a duration across rides, and which ride it came from (E9-2). */
export interface BestPower extends PowerCurvePoint {
  rideId: number
  startedAt: number
  rideName: string
}

/** Seconds in Z1…Z7 for the week starting on `weekStart` (Monday, local date). */
export interface WeekZones {
  weekStart: string
  seconds: number[]
}

/** FTP suggested from recent rides (E9-6). */
export interface FtpEstimate {
  ftpW: number
  /** Best 20-minute power it comes from. */
  best20W: number
  rideId: number
  startedAt: number
  rideName: string
}

export interface ImportResult {
  imported: number
  /** File name and why it was skipped (duplicate, not cycling, …). */
  skipped: string[]
}

/** How often a workout was ridden (E10-4). */
export interface WorkoutDone {
  workoutId: string
  count: number
  /** ms since epoch of the latest ride. */
  lastAt: number
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

/** A route the user imported (E13-7), as stored by main. */
export interface StoredRoute {
  id: string
  name: string
  description?: string
  createdAt: number
  /** `[lat, lon, ele]` triples. */
  points: number[][]
}

export interface BluetoothDeviceInfo {
  id: string
  name: string
}

/** The only API the renderer can call (exposed by the preload as `window.cyclotron`). */
export interface CyclotronApi {
  app: {
    getVersion(): Promise<string>
    /** Opens the folder holding the database and settings (for backups). */
    showDataFolder(): Promise<void>
    /** Scales the whole interface, 1 = 100 %. */
    setZoom(factor: number): void
  }
  /** Small settings (profile, devices, tiles) kept in SQLite so they survive dev vs installed
   * builds, which have different localStorage origins. */
  prefs: {
    /** Synchronous so stores can load their initial state at import time. */
    get(key: string): string | null
    set(key: string, value: string): void
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
    /** Asks where to save a .zwo file (E3-8); returns the path, or null if cancelled. */
    exportZwo(fileName: string, xml: string): Promise<string | null>
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
    detail(rideId: number): Promise<RideDetail | null>
    /** Asks for FIT files and adds them to the history (E9-5). */
    importFit(): Promise<ImportResult>
    /** Finished rides per workout id. */
    workoutsDone(): Promise<WorkoutDone[]>
  }
  analytics: {
    /** Best power per duration over the last `days` days, or all time when null. */
    powerCurve(days: number | null): Promise<BestPower[]>
    /** CTL/ATL/TSB for every day from the first ride to today. */
    load(): Promise<DailyLoad[]>
    /** Time in zones for the last `weeks` weeks, oldest first (empty weeks included). */
    zonesByWeek(weeks: number): Promise<WeekZones[]>
    /** 95 % of the best 20 minutes in the last 90 days, if there is one. */
    ftpEstimate(): Promise<FtpEstimate | null>
  }
  ftp: {
    /** Newest first. */
    history(limit: number): Promise<FtpEntry[]>
    record(entry: FtpEntry): Promise<void>
  }
  routes: {
    list(): Promise<StoredRoute[]>
    save(route: StoredRoute): Promise<void>
    remove(id: string): Promise<void>
    /** Asks for .gpx files and returns their contents; empty if cancelled. */
    pickGpx(): Promise<PickedFile[]>
  }
  spike: {
    /** Asks where to save a BLE capture; returns the path, or null if cancelled. */
    saveCapture(json: string): Promise<string | null>
  }
}

/** IPC channel names shared by main and preload. */
export const IPC = {
  appGetVersion: 'app:getVersion',
  appShowDataFolder: 'app:showDataFolder',
  prefsGet: 'prefs:get',
  prefsSet: 'prefs:set',
  btDeviceList: 'bt:deviceList',
  btSelect: 'bt:select',
  btCancel: 'bt:cancel',
  btPrefer: 'bt:prefer',
  rideKeepAwake: 'ride:keepAwake',
  workoutsLoad: 'workouts:load',
  workoutsSave: 'workouts:save',
  workoutsPickZwo: 'workouts:pickZwo',
  workoutsExportZwo: 'workouts:exportZwo',
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
  ridesDetail: 'rides:detail',
  ridesImportFit: 'rides:importFit',
  ridesWorkoutsDone: 'rides:workoutsDone',
  analyticsPowerCurve: 'analytics:powerCurve',
  analyticsLoad: 'analytics:load',
  analyticsZonesByWeek: 'analytics:zonesByWeek',
  analyticsFtpEstimate: 'analytics:ftpEstimate',
  ftpHistory: 'ftp:history',
  ftpRecord: 'ftp:record',
  routesList: 'routes:list',
  routesSave: 'routes:save',
  routesRemove: 'routes:remove',
  routesPickGpx: 'routes:pickGpx',
  spikeSaveCapture: 'spike:saveCapture',
} as const
