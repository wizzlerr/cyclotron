import { contextBridge, ipcRenderer, webFrame, type IpcRendererEvent } from 'electron'
import { IPC, type BluetoothDeviceInfo, type CyclotronApi, type UpdateStatus } from '../shared/api'

const api: CyclotronApi = {
  app: {
    getVersion: () => ipcRenderer.invoke(IPC.appGetVersion),
    showDataFolder: () => ipcRenderer.invoke(IPC.appShowDataFolder),
    setZoom: (factor) => webFrame.setZoomFactor(Math.min(3, Math.max(0.5, factor))),
  },
  prefs: {
    get: (key) => ipcRenderer.sendSync(IPC.prefsGet, key) as string | null,
    set: (key, value) => ipcRenderer.send(IPC.prefsSet, key, value),
  },
  bluetooth: {
    onDeviceList: (listener) => {
      const handler = (_event: IpcRendererEvent, devices: BluetoothDeviceInfo[]): void =>
        listener(devices)
      ipcRenderer.on(IPC.btDeviceList, handler)
      return () => ipcRenderer.removeListener(IPC.btDeviceList, handler)
    },
    selectDevice: (id) => ipcRenderer.invoke(IPC.btSelect, id),
    cancelSelection: () => ipcRenderer.invoke(IPC.btCancel),
    preferDevice: (nameOrAddress) => ipcRenderer.invoke(IPC.btPrefer, nameOrAddress),
    lastPicked: () => ipcRenderer.invoke(IPC.btLastPicked),
  },
  ride: {
    keepAwake: (on) => ipcRenderer.invoke(IPC.rideKeepAwake, on),
  },
  workouts: {
    load: () => ipcRenderer.invoke(IPC.workoutsLoad),
    save: (json) => ipcRenderer.invoke(IPC.workoutsSave, json),
    pickZwo: () => ipcRenderer.invoke(IPC.workoutsPickZwo),
    exportZwo: (fileName, xml) => ipcRenderer.invoke(IPC.workoutsExportZwo, fileName, xml),
  },
  rides: {
    start: (info) => ipcRenderer.invoke(IPC.ridesStart, info),
    appendSamples: (id, samples) => ipcRenderer.invoke(IPC.ridesAppend, id, samples),
    finish: (id, totals, fit) => ipcRenderer.invoke(IPC.ridesFinish, id, totals, fit),
    unfinished: () => ipcRenderer.invoke(IPC.ridesUnfinished),
    discard: (id) => ipcRenderer.invoke(IPC.ridesDiscard, id),
    setFeedback: (id, feedback) => ipcRenderer.invoke(IPC.ridesFeedback, id, feedback),
    list: (limit) => ipcRenderer.invoke(IPC.ridesList, limit),
    showFit: (id) => ipcRenderer.invoke(IPC.ridesShowFit, id),
    fitFolder: () => ipcRenderer.invoke(IPC.ridesFitFolder),
    chooseFitFolder: () => ipcRenderer.invoke(IPC.ridesChooseFitFolder),
    detail: (id) => ipcRenderer.invoke(IPC.ridesDetail, id),
    importFit: () => ipcRenderer.invoke(IPC.ridesImportFit),
    workoutsDone: () => ipcRenderer.invoke(IPC.ridesWorkoutsDone),
    sendToGarmin: (id) => ipcRenderer.invoke(IPC.ridesSendToGarmin, id),
  },
  analytics: {
    powerCurve: (days) => ipcRenderer.invoke(IPC.analyticsPowerCurve, days),
    load: () => ipcRenderer.invoke(IPC.analyticsLoad),
    zonesByWeek: (weeks) => ipcRenderer.invoke(IPC.analyticsZonesByWeek, weeks),
    ftpEstimate: () => ipcRenderer.invoke(IPC.analyticsFtpEstimate),
    recoRides: (days) => ipcRenderer.invoke(IPC.analyticsRecoRides, days),
    wellness: (days) => ipcRenderer.invoke(IPC.analyticsWellness, days),
  },
  ftp: {
    history: (limit) => ipcRenderer.invoke(IPC.ftpHistory, limit),
    record: (entry) => ipcRenderer.invoke(IPC.ftpRecord, entry),
  },
  routes: {
    list: () => ipcRenderer.invoke(IPC.routesList),
    save: (route) => ipcRenderer.invoke(IPC.routesSave, route),
    remove: (id) => ipcRenderer.invoke(IPC.routesRemove, id),
    pickGpx: () => ipcRenderer.invoke(IPC.routesPickGpx),
  },
  garmin: {
    status: () => ipcRenderer.invoke(IPC.garminStatus),
    setKey: (key) => ipcRenderer.invoke(IPC.garminSetKey, key),
    clearKey: () => ipcRenderer.invoke(IPC.garminClearKey),
    test: () => ipcRenderer.invoke(IPC.garminTest),
    saveSample: () => ipcRenderer.invoke(IPC.garminSaveSample),
    sync: () => ipcRenderer.invoke(IPC.garminSync),
    onSynced: (listener) => {
      const handler = (): void => listener()
      ipcRenderer.on(IPC.garminSynced, handler)
      return () => ipcRenderer.removeListener(IPC.garminSynced, handler)
    },
  },
  update: {
    status: () => ipcRenderer.invoke(IPC.updateStatus),
    check: () => ipcRenderer.invoke(IPC.updateCheck),
    setAuto: (on) => ipcRenderer.invoke(IPC.updateSetAuto, on),
    install: () => ipcRenderer.invoke(IPC.updateInstall),
    onChange: (listener) => {
      const handler = (_event: IpcRendererEvent, s: UpdateStatus): void => listener(s)
      ipcRenderer.on(IPC.updateChanged, handler)
      return () => ipcRenderer.removeListener(IPC.updateChanged, handler)
    },
  },
  strava: {
    status: () => ipcRenderer.invoke(IPC.stravaStatus),
    setApp: (id, secret) => ipcRenderer.invoke(IPC.stravaSetApp, id, secret),
    connect: () => ipcRenderer.invoke(IPC.stravaConnect),
    disconnect: () => ipcRenderer.invoke(IPC.stravaDisconnect),
    setAuto: (on) => ipcRenderer.invoke(IPC.stravaSetAuto, on),
    upload: (id) => ipcRenderer.invoke(IPC.stravaUpload, id),
    openActivity: (id) => ipcRenderer.invoke(IPC.stravaOpenActivity, id),
  },
  diag: {
    log: (level, message) => ipcRenderer.send(IPC.diagLog, level, message),
    saveReport: (input) => ipcRenderer.invoke(IPC.diagSave, input),
    openLogs: () => ipcRenderer.invoke(IPC.diagOpenLogs),
    reportIssue: () => ipcRenderer.invoke(IPC.diagReportIssue),
  },
  spike: {
    saveCapture: (json) => ipcRenderer.invoke(IPC.spikeSaveCapture, json),
  },
}

contextBridge.exposeInMainWorld('cyclotron', api)
