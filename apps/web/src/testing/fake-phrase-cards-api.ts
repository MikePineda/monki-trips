import type { PhraseCard, PhraseCards } from '@monkitrips/shared'
import type { GeneratePhraseCardsRequest, PhraseCardsApi } from '../app/core/api/phrase-cards-api'
import { FakeApi } from './fake-api'

/** Synthetic Thai cards: invented place, the `{name}` placeholder, a little of each category. */
export const THAI_CARDS: PhraseCard[] = [
  {
    category: 'greetings',
    prompt: 'Hello',
    phrase: 'สวัสดีครับ',
    romanization: 'sawatdee khrap',
    note: null,
  },
  {
    category: 'reservation',
    prompt: 'I have a reservation under {name}',
    phrase: 'ผมจองไว้ในชื่อ {name}',
    romanization: 'phom jong wai nai chue {name}',
    note: 'Show it at the front desk.',
  },
  {
    category: 'lodging_address',
    prompt: 'Please take me to this address',
    phrase: 'กรุณาไปส่งที่ 9 ถนนตัวอย่าง',
    romanization: null,
    note: 'Synthetic address.',
  },
  {
    category: 'food',
    prompt: 'No peanuts, please',
    phrase: 'ไม่ใส่ถั่วลิสง',
    romanization: 'mai sai thua lisong',
    note: null,
  },
  {
    category: 'emergency',
    prompt: 'Please call an ambulance',
    phrase: 'ช่วยเรียกรถพยาบาล',
    romanization: null,
    note: null,
  },
  {
    category: 'numbers',
    prompt: 'How much is it?',
    phrase: 'เท่าไหร่',
    romanization: 'thao rai',
    note: null,
  },
]

/** A synthetic set of trip `trip-1`. */
export function phraseCardsRow(overrides: Partial<PhraseCards> = {}): PhraseCards {
  return {
    id: 'set-th',
    tripId: 'trip-1',
    language: 'th',
    cards: THAI_CARDS,
    model: 'fake-phrase-model',
    createdBy: 'local-traveller',
    deletedAt: null,
    updatedAt: '2026-11-07T10:00:00.000Z',
    ...overrides,
  }
}

/** In-memory stand-in for generation: answers `nextSet` (the Thai set by default) for the language asked. */
export class FakePhraseCardsApi extends FakeApi implements PhraseCardsApi {
  readonly requests: GeneratePhraseCardsRequest[] = []
  nextSet: PhraseCards | null = null
  /** When set, `generate` waits for it (a spec checks the waiting state). */
  gate: Promise<void> | null = null

  generate(request: GeneratePhraseCardsRequest): Promise<PhraseCards> {
    return this.run(`generate:${request.language}${request.force ? ':force' : ''}`, async () => {
      this.requests.push(request)
      if (this.gate) {
        await this.gate
      }
      return this.nextSet ?? phraseCardsRow({ tripId: request.tripId, language: request.language })
    })
  }
}
