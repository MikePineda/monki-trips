import { Injectable, inject } from '@angular/core'
import { PHRASE_CARDS_API, type GeneratePhraseCardsRequest } from '../../core/api/phrase-cards-api'
import { OFFLINE_DB } from '../../core/offline/offline-db'
import { toPhraseCardRecord } from '../../core/offline/phrase-card-record'
import type { PhraseCardRecord } from '../../core/offline/records'

/**
 * Generation of phrase cards. The server writes the set; the answer is
 * stored on the device at once (replacing any older set of that trip and
 * language, which the server tombstoned on `force`) so the cards show and
 * work offline before the next pull brings the same row.
 */
@Injectable({ providedIn: 'root' })
export class PhraseCardsStore {
  private readonly api = inject(PHRASE_CARDS_API)
  private readonly database = inject(OFFLINE_DB)

  async generate(request: GeneratePhraseCardsRequest): Promise<PhraseCardRecord> {
    const record = toPhraseCardRecord(await this.api.generate(request))
    const db = await this.database
    await db.transaction('rw', db.phraseCards, async () => {
      await db.phraseCards
        .where('[tripId+language]')
        .equals([record.tripId, record.language])
        .delete()
      await db.phraseCards.put(record)
    })
    return record
  }
}
