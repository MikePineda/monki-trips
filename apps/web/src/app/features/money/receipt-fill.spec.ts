import type { ReceiptDraft } from '@monkitrips/shared'
import { receiptFill } from './receipt-fill'

const CATEGORIES = [
  { id: 'cat-food', key: 'food' },
  { id: 'cat-custom', key: null },
]

const draft = (overrides: Partial<ReceiptDraft>): ReceiptDraft => ({
  amount: null,
  currency: null,
  spentOn: null,
  merchant: null,
  categoryKey: null,
  review: [],
  ...overrides,
})

describe('receiptFill', () => {
  it('reads the amount as keypad digits in the receipt currency', () => {
    expect(receiptFill(draft({ amount: '12.9', currency: 'eur' }), CATEGORIES, 'JPY')).toEqual({
      digits: '12.90',
      currency: 'EUR',
      spentOn: null,
      categoryId: null,
    })
    expect(receiptFill(draft({ amount: '450' }), CATEGORIES, 'JPY').digits).toBe('450')
  })

  it('matches the category by its default key and keeps a valid date only', () => {
    const fill = receiptFill(
      draft({ categoryKey: 'food', spentOn: '2027-01-20' }),
      CATEGORIES,
      'EUR'
    )
    expect(fill).toMatchObject({ categoryId: 'cat-food', spentOn: '2027-01-20' })
    expect(receiptFill(draft({ spentOn: 'yesterday' }), CATEGORIES, 'EUR').spentOn).toBeNull()
  })

  it('a refund or junk amount is left for the member', () => {
    expect(receiptFill(draft({ amount: '-3.00' }), CATEGORIES, 'EUR').digits).toBeNull()
    expect(receiptFill(draft({ amount: 'about 5' }), CATEGORIES, 'EUR').digits).toBeNull()
    expect(receiptFill(draft({ currency: 'euro' }), CATEGORIES, 'EUR').currency).toBeNull()
  })
})
