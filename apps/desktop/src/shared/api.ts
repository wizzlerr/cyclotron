import type { DailyLoad, DailyWellness, PowerCurvePoint, RideSample } from '@cyclotron/core'

export type { DailyLoad, DailyWellness, PowerCurvePoint, RideSample }

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
  /** Strava activity it was uploaded as (E12-7). */
  stravaId?: number
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

/** A finished ride as the recommendation engine needs it (E11). */
export interface RecoRide {
  /** Local date, YYYY-MM-DD. */
  date: string
  workoutId?: string
  tss: number
  intensity: number
  timerS: number
  feedback?: RideFeedback
  /** Share of work seconds on target (E11-8). */
  targetHit?: number
  /** Seconds in Z1…Z7. */
  zoneS: number[]
  /** Another sport or a ride not recorded here, from Garmin (E12-5). */
  external?: boolean
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

/** Garmin Connect Personal API connection (E12). The key itself never reaches the renderer. */
export interface GarminStatus {
  connected: boolean
  /** Last 4 characters of the saved key. */
  keyHint?: string
  savedAt?: number
  /** Last successful call. */
  lastOkAt?: number
  /** Last completed sync of activities and wellness data (E12-5). */
  lastSyncAt?: number
  /** Other activities stored from Garmin. */
  activities?: number
  /** OS key store available (needed to save the key). */
  encryption: boolean
  /** Set when the last action failed; worded by the UI. */
  error?: 'noKey' | 'invalidKey' | 'network' | 'http' | 'encryption'
  /** HTTP status for `http` errors. */
  status?: number
  /** Where "Save sample data" wrote its file. */
  file?: string
}

/** Auto-update (E7-5). */
export interface UpdateStatus {
  state: 'dev' | 'idle' | 'checking' | 'latest' | 'available' | 'downloading' | 'ready' | 'error'
  current: string
  /** The new version, when there is one. */
  version?: string
  percent?: number
  error?: string
  /** Check automatically on start and every few hours. */
  auto?: boolean
}

/** Strava upload (E12-7). Secret and tokens never reach the renderer. */
export interface StravaStatus {
  /** The rider's own Strava API app (Client ID + Secret) is saved. */
  hasApp: boolean
  clientId?: string
  connected: boolean
  athlete?: string
  /** Upload every finished ride automatically. */
  auto: boolean
  encryption: boolean
  error?:
    | 'noApp'
    | 'notConnected'
    | 'denied'
    | 'timeout'
    | 'network'
    | 'http'
    | 'encryption'
    | 'noFit'
    | 'rejected'
  /** Technical detail for the error, shown small. */
  detail?: string
  /** After an upload. */
  activityUrl?: string
}

/** What the renderer adds to a diagnostic report (main adds version, system and the log). */
export interface DiagnosticInput {
  /** Connected devices, their capabilities and what they published (FTMS features, ranges). */
  devices: unknown
  /** Non-sensitive settings (no keys or tokens). */
  settings: unknown
  /** Recent Bluetooth packets and events, oldest first. */
  bleTrace: string[]
  /** What the rider was doing / the screen they were on. */
  context: unknown
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
    /** Picks the device with this name or address as soon as a scan finds it (remembered devices). */
    preferDevice(nameOrAddress: string | null): Promise<void>
    /** Address of the device the last `requestDevice()` picked (Windows: the MAC address). */
    lastPicked(): Promise<string | null>
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
    /** Shows the ride's FIT file and opens Garmin Connect's import page (E12-4, semi-manual). */
    sendToGarmin(rideId: number): Promise<void>
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
    /** Finished rides of the last `days` days, oldest first, for recommendations (E11). */
    recoRides(days: number): Promise<RecoRide[]>
    /** Daily wellness values of the last `days` days (E12-6). */
    wellness(days: number): Promise<DailyWellness[]>
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
  garmin: {
    status(): Promise<GarminStatus>
    /** Checks the key with Garmin, then stores it encrypted. */
    setKey(key: string): Promise<GarminStatus>
    clearKey(): Promise<GarminStatus>
    test(): Promise<GarminStatus>
    /** Saves a week of every endpoint to a JSON file and shows it (E12-3). */
    saveSample(): Promise<GarminStatus>
    /** Pulls other activities and wellness data now (E12-5). */
    sync(): Promise<GarminStatus>
    /** Called after every completed sync (also the scheduled ones). Returns an unsubscribe. */
    onSynced(listener: () => void): () => void
  }
  update: {
    status(): Promise<UpdateStatus>
    check(): Promise<UpdateStatus>
    setAuto(on: boolean): Promise<UpdateStatus>
    /** Restarts into a downloaded update, or opens the release page (macOS, not signed). */
    install(): Promise<void>
    onChange(listener: (s: UpdateStatus) => void): () => void
  }
  strava: {
    status(): Promise<StravaStatus>
    setApp(clientId: string, clientSecret: string): Promise<StravaStatus>
    /** Opens Strava in the browser to authorise; resolves when done (or failed). */
    connect(): Promise<StravaStatus>
    disconnect(): Promise<StravaStatus>
    setAuto(on: boolean): Promise<StravaStatus>
    upload(rideId: number): Promise<StravaStatus>
    openActivity(id: number): Promise<void>
  }
  diag: {
    /** Adds a line to the log file. */
    log(level: 'info' | 'warn' | 'error', message: string): void
    /** Asks where to save a diagnostic report; returns the path, or null if cancelled. */
    saveReport(input: DiagnosticInput): Promise<string | null>
    openLogs(): Promise<void>
    reportIssue(): Promise<void>
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
  btLastPicked: 'bt:lastPicked',
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
  analyticsRecoRides: 'analytics:recoRides',
  ftpHistory: 'ftp:history',
  ftpRecord: 'ftp:record',
  routesList: 'routes:list',
  routesSave: 'routes:save',
  routesRemove: 'routes:remove',
  routesPickGpx: 'routes:pickGpx',
  spikeSaveCapture: 'spike:saveCapture',
  diagLog: 'diag:log',
  stravaStatus: 'strava:status',
  updateStatus: 'update:status',
  updateCheck: 'update:check',
  updateSetAuto: 'update:setAuto',
  updateInstall: 'update:install',
  updateChanged: 'update:changed',
  stravaSetApp: 'strava:setApp',
  stravaConnect: 'strava:connect',
  stravaDisconnect: 'strava:disconnect',
  stravaSetAuto: 'strava:setAuto',
  stravaUpload: 'strava:upload',
  stravaOpenActivity: 'strava:openActivity',
  diagSave: 'diag:save',
  diagOpenLogs: 'diag:openLogs',
  diagReportIssue: 'diag:reportIssue',
  ridesSendToGarmin: 'rides:sendToGarmin',
  garminStatus: 'garmin:status',
  garminSetKey: 'garmin:setKey',
  garminClearKey: 'garmin:clearKey',
  garminTest: 'garmin:test',
  garminSaveSample: 'garmin:saveSample',
  garminSync: 'garmin:sync',
  garminSynced: 'garmin:synced',
  analyticsWellness: 'analytics:wellness',
} as const
