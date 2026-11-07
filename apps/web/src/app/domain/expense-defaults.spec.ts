import { categoryKeyForHour, defaultCategoryId, defaultCurrency } from './expense-defaults'

const categories = [
  { id: 'c-food', key: 'food' },
  { id: 'c-transport', key: 'transport' },
  { id: 'c-activities', key: 'activities' },
  { id: 'c-other', key: 'other' },
  { id: 'c-custom', key: null },
]

describe('categoryKeyForHour', () => {
  it('suggests food at meal times, transport early, activities in the day and other at night', () => {
    expect(categoryKeyForHour(8)).toBe('food')
    expect(categoryKeyForHour(13)).toBe('food')
    expect(categoryKeyForHour(20)).toBe('food')
    expect(categoryKeyForHour(6)).toBe('transport')
    expect(categoryKeyForHour(11)).toBe('activities')
    expect(categoryKeyForHour(16)).toBe('activities')
    expect(categoryKeyForHour(23)).toBe('other')
    expect(categoryKeyForHour(2)).toBe('other')
  })
})

describe('defaultCategoryId', () => {
  it('prefers the category used last', () => {
    expect(defaultCategoryId({ lastUsedId: 'c-custom', localHour: 13, categories })).toBe(
      'c-custom'
    )
  })

  it('falls back to the time of day when nothing was used yet or the last one is gone', () => {
    expect(defaultCategoryId({ lastUsedId: null, localHour: 13, categories })).toBe('c-food')
    expect(defaultCategoryId({ lastUsedId: 'deleted', localHour: 16, categories })).toBe(
      'c-activities'
    )
  })

  it('takes the first category when the suggested key does not exist, and null without categories', () => {
    expect(
      defaultCategoryId({ lastUsedId: null, localHour: 13, categories: [categories[4]] })
    ).toBe('c-custom')
    expect(defaultCategoryId({ lastUsedId: null, localHour: 13, categories: [] })).toBeNull()
  })
})

describe('defaultCurrency', () => {
  const stops = [
    { position: 0, countryCode: 'JP', arriveOn: '2027-01-20', departOn: '2027-01-23' },
    { position: 1, countryCode: 'XA', arriveOn: '2027-01-23', departOn: '2027-01-26' },
  ]

  it('currency defaults to the current stop', () => {
    expect(defaultCurrency(stops, '2027-01-21', 'AUD')).toBe('JPY')
  })

  it('falls back to the base currency outside the stops or in a country it does not know', () => {
    expect(defaultCurrency(stops, '2027-01-10', 'AUD')).toBe('AUD')
    expect(defaultCurrency(stops, '2027-01-24', 'AUD')).toBe('AUD')
    expect(defaultCurrency([], '2027-01-21', 'EUR')).toBe('EUR')
  })
})
