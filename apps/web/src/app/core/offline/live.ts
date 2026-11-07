import {
  DestroyRef,
  ErrorHandler,
  Injector,
  assertInInjectionContext,
  inject,
  signal,
  type Signal,
} from '@angular/core'
import type { MonkiTripsDb } from './db'
import { OFFLINE_DB } from './offline-db'

export interface LiveSignalOptions {
  /** Needed when called outside an injection context. */
  injector?: Injector
}

/**
 * Turns a Dexie query into a signal that follows every write to the tables
 * it reads. The querier gets the database once Dexie has loaded (it lives
 * in a lazy chunk, see `OFFLINE_DB`). The subscription ends with the
 * injector (component, service) that created it. Until the first result
 * arrives the signal holds `initial`; on a query error it keeps its last
 * value and reports the error to Angular's ErrorHandler.
 */
export function liveSignal<T>(
  querier: (db: MonkiTripsDb) => Promise<T> | T,
  initial: T,
  options: LiveSignalOptions = {}
): Signal<T> {
  if (!options.injector) {
    assertInInjectionContext(liveSignal)
  }
  const injector = options.injector ?? inject(Injector)
  const value = signal<T>(initial)
  const report = (error: unknown) => injector.get(ErrorHandler).handleError(error)
  let destroyed = false
  let unsubscribe = () => undefined as void
  injector.get(DestroyRef).onDestroy(() => {
    destroyed = true
    unsubscribe()
  })

  void Promise.all([import('dexie'), injector.get(OFFLINE_DB)])
    .then(([{ liveQuery }, db]) => {
      if (destroyed) {
        return
      }
      const subscription = liveQuery(() => querier(db)).subscribe({
        next: (next) => value.set(next),
        error: report,
      })
      unsubscribe = () => subscription.unsubscribe()
    })
    .catch(report)
  return value.asReadonly()
}
