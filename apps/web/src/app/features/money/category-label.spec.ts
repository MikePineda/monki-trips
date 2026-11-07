import { CATEGORY_LABEL_KEYS, categoryLabel } from './category-label'

describe('categoryLabel', () => {
  const labels = CATEGORY_LABEL_KEYS.map((key) => `T(${key})`)

  it('translates a default category and keeps a custom one by its name', () => {
    expect(categoryLabel({ key: 'food', name: null }, labels)).toBe('T(category.food)')
    expect(categoryLabel({ key: null, name: 'Gifts' }, labels)).toBe('Gifts')
  })

  it('shows an unknown key as written until the labels load', () => {
    expect(categoryLabel({ key: 'spa', name: null }, labels)).toBe('spa')
    expect(categoryLabel({ key: 'food', name: null }, [])).toBe('food')
  })
})
