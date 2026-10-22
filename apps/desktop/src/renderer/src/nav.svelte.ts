export type Screen =
  | 'home'
  | 'ride'
  | 'workouts'
  | 'routes'
  | 'history'
  | 'progress'
  | 'settings'
  | 'builder'
  | 'spike'

/** Screens in the sidebar; labels come from `t().app.nav[id]`. */
export const SCREENS = [
  'home',
  'ride',
  'workouts',
  'routes',
  'history',
  'progress',
  'settings',
] as const satisfies readonly Screen[]

/** Current screen. Plain state-based navigation; no router needed for a desktop app. */
export const nav = $state<{ screen: Screen }>({ screen: 'home' })

export function go(screen: Screen): void {
  nav.screen = screen
}
