import type { PhraseCards } from '@monkitrips/shared'
import type { ApiClientLoader } from './api'
import { apiCall } from './api-failure'
import type { GeneratePhraseCardsRequest, PhraseCardsApi } from './phrase-cards-api'

/** `PhraseCardsApi` over the typed client. */
export class RealPhraseCardsApi implements PhraseCardsApi {
  constructor(private readonly client: ApiClientLoader) {}

  async generate(request: GeneratePhraseCardsRequest): Promise<PhraseCards> {
    const api = await this.client()
    const body =
      request.preferences && request.preferences.length > 0
        ? { language: request.language, preferences: request.preferences }
        : { language: request.language }
    const { data } = await apiCall(() =>
      api.request('trips.phraseCards.store', {
        params: { tripId: request.tripId },
        // The registry types this route's body and query as one union of
        // both validators (the controller validates the query string too),
        // so Tuyau accepts neither key; the shapes here are the contract's.
        ...({ body, query: request.force ? { force: true } : {} } as object),
      })
    )
    return data
  }
}
