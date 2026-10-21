export type Screen = 'home' | 'ride' | 'workouts' | 'history' | 'settings' | 'spike'

export const SCREENS: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'ride', label: 'Ride' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
]

/** Current screen. Plain state-based navigation; no router needed for a desktop app. */
export const nav = $state<{ screen: Screen }>({ screen: 'home' })

export function go(screen: Screen): void {
  nav.screen = screen
}
