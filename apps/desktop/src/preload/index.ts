import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type BluetoothDeviceInfo, type CyclotronApi } from '../shared/api'

const api: CyclotronApi = {
  app: {
    getVersion: () => ipcRenderer.invoke(IPC.appGetVersion),
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
  },
  spike: {
    saveCapture: (json) => ipcRenderer.invoke(IPC.spikeSaveCapture, json),
  },
}

contextBridge.exposeInMainWorld('cyclotron', api)
