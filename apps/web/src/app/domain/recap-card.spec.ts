import { recapCard, type RecapCardInput } from './recap-card'

const input: RecapCardInput = {
  title: 'Island hop',
  dates: '1 May – 10 May 2026',
  route: ['Harbour City', 'Old Town'],
  stats: [
    { id: 'days', label: 'Days', value: '10' },
    { id: 'distance', label: 'Travelled', value: '1,240 km' },
  ],
  money: [{ id: 'spent', label: 'Spent', value: '€1,200.00' }],
  finished: true,
  footer: 'monki-trips',
}

describe('recapCard', () => {
  it('the share image hides money by default', () => {
    const card = recapCard(input)
    expect(card.includesMoney).toBe(false)
    expect(card.rows.map((row) => row.id)).toEqual(['days', 'distance'])
    expect(JSON.stringify(card)).not.toContain('€')
  })

  it('shows money only when the member turns it on', () => {
    const card = recapCard({ ...input, includeMoney: true })
    expect(card.includesMoney).toBe(true)
    expect(card.rows.map((row) => row.id)).toEqual(['days', 'distance', 'spent'])
  })

  it('keeps at most six rows and the route as one line', () => {
    const many = Array.from({ length: 8 }, (_, index) => ({
      id: `s${index}`,
      label: `Stat ${index}`,
      value: String(index),
    }))
    const card = recapCard({ ...input, stats: many })
    expect(card.rows).toHaveLength(6)
    expect(card.route).toBe('Harbour City → Old Town')
  })

  it('celebrates only a finished trip', () => {
    expect(recapCard(input).mascot).toBe('celebrating')
    expect(recapCard({ ...input, finished: false }).mascot).toBe('happy')
  })
})
