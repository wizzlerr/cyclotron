/** 16-bit Bluetooth SIG UUIDs used by Cyclotron (DESIGN.md §4.2). */
export const GATT = {
  fitnessMachine: 0x1826,
  ftmsFeature: 0x2acc,
  indoorBikeData: 0x2ad2,
  trainingStatus: 0x2ad3,
  supportedResistanceLevelRange: 0x2ad6,
  supportedPowerRange: 0x2ad8,
  ftmsControlPoint: 0x2ad9,
  ftmsStatus: 0x2ada,
  cyclingPower: 0x1818,
  cyclingPowerMeasurement: 0x2a63,
  cyclingPowerFeature: 0x2a65,
  cyclingPowerControlPoint: 0x2a66,
  heartRate: 0x180d,
  heartRateMeasurement: 0x2a37,
  battery: 0x180f,
  batteryLevel: 0x2a19,
  deviceInformation: 0x180a,
  cyclingSpeedAndCadence: 0x1816,
} as const

const NAMES: Record<number, string> = {
  0x1800: 'Generic Access',
  0x1801: 'Generic Attribute',
  0x180a: 'Device Information',
  0x180d: 'Heart Rate',
  0x180f: 'Battery',
  0x1816: 'Cycling Speed and Cadence',
  0x1818: 'Cycling Power',
  0x1826: 'Fitness Machine',
  0x2a00: 'Device Name',
  0x2a19: 'Battery Level',
  0x2a23: 'System ID',
  0x2a24: 'Model Number',
  0x2a25: 'Serial Number',
  0x2a26: 'Firmware Revision',
  0x2a27: 'Hardware Revision',
  0x2a28: 'Software Revision',
  0x2a29: 'Manufacturer Name',
  0x2a37: 'Heart Rate Measurement',
  0x2a38: 'Body Sensor Location',
  0x2a5b: 'CSC Measurement',
  0x2a5c: 'CSC Feature',
  0x2a5d: 'Sensor Location',
  0x2a63: 'Cycling Power Measurement',
  0x2a65: 'Cycling Power Feature',
  0x2a66: 'Cycling Power Control Point',
  0x2acc: 'Fitness Machine Feature',
  0x2ad2: 'Indoor Bike Data',
  0x2ad3: 'Training Status',
  0x2ad6: 'Supported Resistance Level Range',
  0x2ad8: 'Supported Power Range',
  0x2ad9: 'Fitness Machine Control Point',
  0x2ada: 'Fitness Machine Status',
}

const SIG_BASE = /^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/i
const WAHOO = /^a026[0-9a-f]{4}-0a7d-4ab3-97fa-f1500f9feb8b$/i

/** Returns the 16-bit form of a SIG base UUID, or undefined for vendor (128-bit) UUIDs. */
export function shortUuid(uuid: string): number | undefined {
  const m = SIG_BASE.exec(uuid)
  return m ? Number.parseInt(m[1]!, 16) : undefined
}

/** Human-readable name for a service/characteristic UUID, if known. */
export function uuidName(uuid: string): string | undefined {
  const short = shortUuid(uuid)
  if (short !== undefined) return NAMES[short]
  if (WAHOO.test(uuid)) return 'Wahoo (proprietary)'
  return undefined
}

/** Full 128-bit UUID for a 16-bit SIG UUID. */
export function sigUuid(short: number): string {
  return `0000${short.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`
}
