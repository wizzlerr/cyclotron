// Training load: fitness (CTL), fatigue (ATL) and form (TSB) from daily TSS (DESIGN.md §5).

const CTL_DAYS = 42
const ATL_DAYS = 7

export interface DailyLoad {
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  tss: number
  /** Fitness after this day. */
  ctl: number
  /** Fatigue after this day. */
  atl: number
  /** Form going into this day: yesterday's CTL − ATL. */
  tsb: number
}

/**
 * Day-by-day load from `from` to `to` (inclusive), with days without rides as 0 TSS.
 * `start` is the CTL/ATL going into `from` (0 for a new rider).
 */
export function dailyLoad(
  tssByDate: ReadonlyMap<string, number>,
  from: string,
  to: string,
  start: { ctl: number; atl: number } = { ctl: 0, atl: 0 },
): DailyLoad[] {
  const out: DailyLoad[] = []
  let { ctl, atl } = start
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const tss = tssByDate.get(date) ?? 0
    const tsb = ctl - atl
    ctl += (tss - ctl) / CTL_DAYS
    atl += (tss - atl) / ATL_DAYS
    out.push({ date, tss, ctl: round1(ctl), atl: round1(atl), tsb: round1(tsb) })
  }
  return out
}

/** `YYYY-MM-DD` plus `days` (calendar arithmetic, no time zones involved). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10)
}

/** Local calendar date of an instant, given the local UTC offset in minutes. */
export function localDate(ms: number, utcOffsetMin: number): string {
  return new Date(ms + utcOffsetMin * 60_000).toISOString().slice(0, 10)
}

const round1 = (n: number): number => Math.round(n * 10) / 10
