import { contextBridge, ipcRenderer, webFrame, type IpcRendererEvent } from 'electron'
import { IPC, type BluetoothDeviceInfo, type CyclotronApi } from '../shared/api'

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
    preferDevice: (name) => ipcRenderer.invoke(IPC.btPrefer, name),
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
  },
  analytics: {
    powerCurve: (days) => ipcRenderer.invoke(IPC.analyticsPowerCurve, days),
    load: () => ipcRenderer.invoke(IPC.analyticsLoad),
    zonesByWeek: (weeks) => ipcRenderer.invoke(IPC.analyticsZonesByWeek, weeks),
    ftpEstimate: () => ipcRenderer.invoke(IPC.analyticsFtpEstimate),
    recoRides: (days) => ipcRenderer.invoke(IPC.analyticsRecoRides, days),
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
  spike: {
    saveCapture: (json) => ipcRenderer.invoke(IPC.spikeSaveCapture, json),
  },
}

contextBridge.exposeInMainWorld('cyclotron', api)
