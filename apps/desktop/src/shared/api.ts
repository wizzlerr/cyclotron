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
  spikeSaveCapture: 'spike:saveCapture',
} as const
