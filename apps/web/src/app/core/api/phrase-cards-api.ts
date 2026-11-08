import { inject, InjectionToken } from '@angular/core'
import type { GeneratePhraseCardsInput, PhraseCards } from '@monkitrips/shared'
import { API } from './api'
import { RealPhraseCardsApi } from './real-phrase-cards-api'

export interface GeneratePhraseCardsRequest extends GeneratePhraseCardsInput {
  tripId: string
  /** Replace the live set of that language (`?force=true`) instead of a 409. */
  force?: boolean
}

/**
 * Generation of phrase cards (`POST /trips/:tripId/phrase-cards`), online
 * only. Reading never goes through here: the cards reach the device through
 * the pull (`phrase_card`). Failures are ApiFailures: 402
 * `E_LLM_QUOTA_EXCEEDED` (details `{ used, cap, resetsOn }`), 429
 * `E_TOO_MANY_REQUESTS`, 409 `E_CONFLICT`, 503 `E_LLM_UNAVAILABLE`, 422.
 */
export interface PhraseCardsApi {
  generate(request: GeneratePhraseCardsRequest): Promise<PhraseCards>
}

export const PHRASE_CARDS_API = new InjectionToken<PhraseCardsApi>('PHRASE_CARDS_API', {
  providedIn: 'root',
  factory: () => new RealPhraseCardsApi(inject(API)),
})
