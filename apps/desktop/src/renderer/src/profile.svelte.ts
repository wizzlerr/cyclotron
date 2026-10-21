const KEY = 'cyclotron.profile'
const DEFAULT_FTP_W = 200

interface Stored {
  ftpW?: number
}

function load(): Stored {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Stored
  } catch {
    return {}
  }
}

/** Rider profile. Kept in localStorage until desktop SQLite arrives (E5). */
class Profile {
  ftpW = $state(load().ftpW ?? DEFAULT_FTP_W)

  setFtp(watts: number): void {
    if (!Number.isFinite(watts) || watts < 50 || watts > 600) return
    this.ftpW = Math.round(watts)
    try {
      localStorage.setItem(KEY, JSON.stringify({ ftpW: this.ftpW } satisfies Stored))
    } catch {
      // Keeps working for this session.
    }
  }
}

export const profile = new Profile()
