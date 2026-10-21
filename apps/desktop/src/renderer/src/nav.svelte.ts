export type Screen =
  'home' | 'ride' | 'workouts' | 'routes' | 'history' | 'progress' | 'settings' | 'spike'

export const SCREENS: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'ride', label: 'Ride' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'routes', label: 'Routes' },
  { id: 'history', label: 'History' },
  { id: 'progress', label: 'Progress' },
  { id: 'settings', label: 'Settings' },
]

/** Current screen. Plain state-based navigation; no router needed for a desktop app. */
export const nav = $state<{ screen: Screen }>({ screen: 'home' })

export function go(screen: Screen): void {
  nav.screen = screen
}
