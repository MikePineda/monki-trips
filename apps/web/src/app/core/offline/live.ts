import {
  DestroyRef,
  ErrorHandler,
  Injector,
  assertInInjectionContext,
  inject,
  signal,
  type Signal,
} from '@angular/core'
import { liveQuery } from 'dexie'

export interface LiveSignalOptions {
  /** Needed when called outside an injection context. */
  injector?: Injector
}

/**
 * Turns a Dexie query into a signal that follows every write to the tables
 * it reads. The subscription ends with the injector (component, service)
 * that created it. Until the first result arrives the signal holds
 * `initial`; on a query error it keeps its last value and reports the
 * error to Angular's ErrorHandler.
 */
export function liveSignal<T>(
  querier: () => Promise<T> | T,
  initial: T,
  options: LiveSignalOptions = {}
): Signal<T> {
  if (!options.injector) {
    assertInInjectionContext(liveSignal)
  }
  const injector = options.injector ?? inject(Injector)
  const value = signal<T>(initial)
  const subscription = liveQuery(querier).subscribe({
    next: (next) => value.set(next),
    error: (error: unknown) => injector.get(ErrorHandler).handleError(error),
  })
  injector.get(DestroyRef).onDestroy(() => subscription.unsubscribe())
  return value.asReadonly()
}
