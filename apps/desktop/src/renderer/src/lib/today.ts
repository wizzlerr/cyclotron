import { localDate } from '@cyclotron/core'

// The local calendar day, for code that works in days (recommendations). Kept out of .svelte.ts
// files so it isn't mistaken for reactive state.

/** Today as YYYY-MM-DD in local time, and its weekday (0 = Sunday). */
export function localToday(): { date: string; weekday: number } {
  const now = new Date()
  return { date: localDate(now.getTime(), -now.getTimezoneOffset()), weekday: now.getDay() }
}
