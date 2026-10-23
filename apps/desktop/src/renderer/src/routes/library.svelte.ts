import {
  buildRoute,
  builtinRoutes,
  fromTriples,
  parseGpx,
  parseRouteKey,
  routeTriples,
  routeVariant,
  type Route,
} from '@cyclotron/core'
import type { StoredRoute } from '../../../shared/api'
import { errorText } from '../i18n/errors'
import { t } from '../i18n/t'
import { loadPref, savePref } from '../lib/prefs'

const FAVOURITES_KEY = 'cyclotron.routeFavourites'

/** Built-in routes plus the user's imported GPX routes (stored by main in SQLite, E13-7). */
class RouteLibrary {
  imported = $state.raw<Route[]>([])
  favourites = $state.raw<string[]>(loadPref<string[]>(FAVOURITES_KEY) ?? [])
  /** Messages from the last import, e.g. files that weren't valid GPX. */
  messages = $state.raw<string[]>([])
  private loaded: Promise<void> | undefined

  get all(): Route[] {
    return [...builtinRoutes(), ...this.imported]
  }

  find(id: string): Route | undefined {
    return this.all.find((r) => r.id === id)
  }

  /** A route as ridden, from its `routeKey` (a stored ride's `routeId`). */
  resolve(key: string): Route | undefined {
    const { id, variant } = parseRouteKey(key)
    const route = this.find(id)
    return route && variant ? routeVariant(route, variant) : route
  }

  load(): Promise<void> {
    this.loaded ??= window.cyclotron.routes.list().then((stored) => {
      this.imported = stored.flatMap((s) => {
        try {
          return [toRoute(s)]
        } catch {
          return []
        }
      })
    })
    return this.loaded
  }

  async importGpx(): Promise<void> {
    await this.load()
    const files = await window.cyclotron.routes.pickGpx()
    if (files.length === 0) return
    const added: Route[] = []
    const messages: string[] = []
    for (const f of files) {
      try {
        const gpx = parseGpx(f.text)
        const stored: StoredRoute = {
          id: `gpx.${crypto.randomUUID()}`,
          name: gpx.name ?? f.name.replace(/\.gpx$/i, ''),
          createdAt: Date.now(),
          points: routeTriples(gpx.points),
        }
        const route = toRoute(stored)
        if (!gpx.points.some((p) => p.ele !== undefined)) {
          messages.push(t().library.routes.noElevation(f.name))
        }
        await window.cyclotron.routes.save(stored)
        added.push(route)
      } catch (e) {
        messages.push(`${f.name}: ${errorText(e)}`)
      }
    }
    if (added.length > 0) {
      messages.unshift(t().library.routes.imported(added.length))
      this.imported = [...this.imported, ...added]
    }
    this.messages = messages
  }

  async remove(id: string): Promise<void> {
    await window.cyclotron.routes.remove(id)
    this.imported = this.imported.filter((r) => r.id !== id)
    if (this.favourites.includes(id)) this.toggleFavourite(id)
  }

  isFavourite(id: string): boolean {
    return this.favourites.includes(id)
  }

  toggleFavourite(id: string): void {
    this.favourites = this.favourites.includes(id)
      ? this.favourites.filter((x) => x !== id)
      : [...this.favourites, id]
    savePref(FAVOURITES_KEY, this.favourites)
  }
}

function toRoute(s: StoredRoute): Route {
  return buildRoute(
    { id: s.id, name: s.name, description: s.description, source: 'gpx' },
    fromTriples(s.points),
  )
}

export const routeLibrary = new RouteLibrary()
