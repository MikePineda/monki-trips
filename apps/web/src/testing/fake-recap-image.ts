import type { RecapCard } from '../app/domain/recap-card'
import type { RecapImageOutcome, RecapImageSharer } from '../app/features/recap/recap-image'

/** A recap image sharer that keeps the cards it was asked to draw. */
export class FakeRecapImage implements RecapImageSharer {
  readonly cards: { card: RecapCard; fileName: string }[] = []
  outcome: RecapImageOutcome = 'downloaded'

  share(card: RecapCard, fileName: string): Promise<RecapImageOutcome> {
    this.cards.push({ card, fileName })
    return Promise.resolve(this.outcome)
  }
}
