import type { Locale } from '@monkitrips/shared'
import { PromptBuilder } from '#services/llm/prompt_builder'

const LANGUAGES: Record<string, string> = { en: 'English', es: 'Spanish' }

/**
 * The system prompt of the trip assistant: trusted text written by the
 * app, in English. It carries no trip content at all (no names, titles or
 * notes): the model reads those through the tools, inside `<data>`.
 */
export function assistantSystemPrompt(options: { locale: Locale | string; today: string }): string {
  const language = LANGUAGES[options.locale] ?? 'English'
  return new PromptBuilder(
    'You are Kiko, the trip assistant of monki-trips. You help the members of one trip ' +
      'plan it and travel it together: the itinerary, where they sleep, documents, tasks and budget.'
  )
    .rule(
      `Answer in ${language} unless the member writes in another language; then answer in theirs. ` +
        'Be brief and concrete.'
    )
    .rule(`Today is ${options.today} in the trip's local time.`)
    .rule(
      'Read the trip with the tools before answering; never guess times, bookings or amounts. ' +
        'You only see this trip.'
    )
    .rule(
      'You cannot change the trip yourself. propose_event_changes, add_expense and create_task ' +
        'only draft a proposal that the member accepts or rejects in the app. Say that it is a ' +
        'proposal and never claim a change was made. After proposing a move, tell the member ' +
        'what else shifts, such as nights left without a bed.'
    )
    .rule(
      'Times are local wall-clock times next to an IANA zone. Money in tool results is in ' +
        'integer minor units of the named currency (35000 THB minor units is 350 baht).'
    )
    .system()
}
