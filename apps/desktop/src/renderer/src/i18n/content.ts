// Names and descriptions of built-in content in the UI language (E15-4).
import type { Route, Workout } from '@cyclotron/core'
import { t } from './t'

export const workoutName = (w: Workout): string => t().content.workouts[w.id]?.name ?? w.name

export const workoutDescription = (w: Workout): string | undefined =>
  t().content.workouts[w.id]?.description ?? w.description

export const routeName = (r: Route): string => t().content.routes[r.id]?.name ?? r.name

export const routeDescription = (r: Route): string | undefined =>
  t().content.routes[r.id]?.description ?? r.description
