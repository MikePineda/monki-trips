import { PHRASE_CARD_NAME_PLACEHOLDER } from '@monkitrips/shared'

/** Whether a card text names a person through the `{name}` placeholder. */
export function hasNamePlaceholder(text: string | null): boolean {
  return text !== null && text.includes(PHRASE_CARD_NAME_PLACEHOLDER)
}

/**
 * The card text with every `{name}` replaced by the name the traveller
 * picked. Runs on the device only, when a card is shown: the name never
 * travels to the server. A blank name leaves the placeholder visible so
 * the traveller sees a name is missing. Pure.
 */
export function fillName(text: string, name: string): string {
  const trimmed = name.trim()
  return trimmed === '' ? text : text.split(PHRASE_CARD_NAME_PLACEHOLDER).join(trimmed)
}

/**
 * The name to fill in before the traveller picks one: their own traveller
 * row on the trip, else their account's display name, else the first
 * traveller. Pure.
 */
export function defaultCardName(
  travellers: readonly { userId: string | null; displayName: string }[],
  userId: string | null,
  accountName: string | null
): string {
  const own = travellers.find((traveller) => userId !== null && traveller.userId === userId)
  return own?.displayName ?? accountName ?? travellers[0]?.displayName ?? ''
}
