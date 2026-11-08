/**
 * What the shareable recap image shows: the trip's name, dates and route,
 * a few headline numbers and Kiko. It is built only from what the caller
 * passes in, and the caller never passes booking codes, addresses or
 * documents; money joins the rows only when the member turns "include
 * money" on (off by default). Pure: strings in, a card model out; the
 * canvas painter draws exactly this.
 */
export interface RecapCardRow {
  id: string
  /** Already translated. */
  label: string
  /** Already formatted. */
  value: string
}

export interface RecapCardInput {
  title: string
  dates: string
  /** Place names in itinerary order. */
  route: readonly string[]
  /** Headline numbers that carry no money. */
  stats: readonly RecapCardRow[]
  /** Money rows: drawn only with `includeMoney`. */
  money: readonly RecapCardRow[]
  /** Off unless the member asks for it. */
  includeMoney?: boolean
  finished: boolean
  footer: string
}

export interface RecapCard {
  title: string
  dates: string
  route: string
  rows: RecapCardRow[]
  includesMoney: boolean
  mascot: 'celebrating' | 'happy'
  footer: string
}

/** The image is a card, not a report: six rows at most. */
export const RECAP_CARD_MAX_ROWS = 6

export function recapCard(input: RecapCardInput): RecapCard {
  const includesMoney = input.includeMoney === true
  const rows = [...input.stats, ...(includesMoney ? input.money : [])].slice(0, RECAP_CARD_MAX_ROWS)
  return {
    title: input.title,
    dates: input.dates,
    route: input.route.join(' → '),
    rows: rows.map((row) => ({ ...row })),
    includesMoney,
    mascot: input.finished ? 'celebrating' : 'happy',
    footer: input.footer,
  }
}
