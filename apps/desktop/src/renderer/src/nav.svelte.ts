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

/** Settings groups, in tab order; labels come from `t().app.settings.tabs[id]`. */
export const SETTINGS_TABS = ['devices', 'training', 'ride', 'connections', 'app'] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

/** Current screen. Plain state-based navigation; no router needed for a desktop app. */
export const nav = $state<{ screen: Screen; settingsTab: SettingsTab }>({
  screen: 'home',
  settingsTab: 'devices',
})

/** `tab` opens Settings on that group (e.g. "connect a trainer" → devices). */
export function go(screen: Screen, tab?: SettingsTab): void {
  nav.screen = screen
  if (tab) nav.settingsTab = tab
}
