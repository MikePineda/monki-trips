import { computed, inject, type Signal } from '@angular/core'
import { tripTravellers } from '../../core/offline/trip-queries'
import { SessionStore } from '../../core/session/session.store'
import { defaultCardName } from '../../domain/phrase-card-name'
import { PhraseNameStore } from './phrase-name.store'

export interface CardName {
  /** The name the cards show: the picked one, else the traveller's own. */
  name: Signal<string>
  /** Everyone on the trip, the picker's choices. */
  choices: Signal<string[]>
}

/**
 * The name that replaces `{name}` on this device, for the list and the
 * full-screen card alike. Call from an injection context.
 */
export function cardName(tripId: Signal<string>): CardName {
  const session = inject(SessionStore)
  const picked = inject(PhraseNameStore).forTrip(tripId)
  const travellers = tripTravellers(tripId)
  const fallback = computed(() =>
    defaultCardName(travellers(), session.user()?.id ?? null, session.user()?.displayName ?? null)
  )
  return {
    name: computed(() => picked() ?? fallback()),
    choices: computed(() => {
      const names = travellers().map((traveller) => traveller.displayName)
      const own = fallback()
      return [...new Set(own ? [own, ...names] : names)]
    }),
  }
}
