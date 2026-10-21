// Small JSON settings, stored by main in SQLite (see main/prefs.ts).

/** Reads a setting. Values saved by older builds in localStorage are moved over once. */
export function loadPref<T>(key: string): T | undefined {
  try {
    let raw = window.cyclotron.prefs.get(key)
    if (raw === null) {
      raw = localStorage.getItem(key)
      if (raw !== null) window.cyclotron.prefs.set(key, raw)
    }
    return raw === null ? undefined : (JSON.parse(raw) as T)
  } catch {
    return undefined
  }
}

export function savePref(key: string, value: unknown): void {
  try {
    window.cyclotron.prefs.set(key, JSON.stringify(value))
  } catch (e) {
    console.error('saving setting failed', key, e)
  }
}
