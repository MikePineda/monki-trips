import { Injectable, computed, inject, type Signal } from '@angular/core'
import { MetaStore } from '../../core/offline/meta.store'

/** Meta key of the names picked per trip. Local to this device: meta never syncs. */
export const META_PHRASE_NAMES = 'phrases.names'

/**
 * The name the traveller picked for the `{name}` placeholder of each trip,
 * kept in the device's meta table so the list and the full-screen card
 * agree and the choice survives a reload. It never leaves the device.
 */
@Injectable({ providedIn: 'root' })
export class PhraseNameStore {
  private readonly meta = inject(MetaStore)
  private readonly names = this.meta.watch<Record<string, string>>(META_PHRASE_NAMES, {})

  /** The picked name of a trip, or null when none was picked yet. */
  forTrip(tripId: Signal<string>): Signal<string | null> {
    return computed(() => this.names()[tripId()] ?? null)
  }

  async pick(tripId: string, name: string): Promise<void> {
    const current = (await this.meta.get<Record<string, string>>(META_PHRASE_NAMES)) ?? {}
    await this.meta.set(META_PHRASE_NAMES, { ...current, [tripId]: name })
  }
}
