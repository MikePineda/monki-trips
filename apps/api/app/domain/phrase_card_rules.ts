import { PHRASE_CARD_NAME_PLACEHOLDER, type PhraseCard } from '@monkitrips/shared'

/**
 * What a generated set must satisfy beyond its shape (the VineJS schema
 * checks the shape): a reservation card that carries the `{name}`
 * placeholder, so no real name is ever asked of the model or stored, and
 * at least one card of every category the request asked for. Returns one
 * line per problem, in the model's language (they go back to it on retry).
 */
export function phraseCardProblems(cards: PhraseCard[], required: string[]): string[] {
  const problems: string[] = []
  const categories = new Set(cards.map((card) => card.category))
  for (const category of required) {
    if (!categories.has(category as PhraseCard['category'])) {
      problems.push(`no card of category "${category}"`)
    }
  }
  const reservation = cards.filter((card) => card.category === 'reservation')
  if (
    reservation.length > 0 &&
    !reservation.some(
      (card) =>
        card.prompt.includes(PHRASE_CARD_NAME_PLACEHOLDER) &&
        card.phrase.includes(PHRASE_CARD_NAME_PLACEHOLDER)
    )
  ) {
    problems.push(
      `the reservation card must keep the literal placeholder ${PHRASE_CARD_NAME_PLACEHOLDER} in both prompt and phrase`
    )
  }
  return problems
}
