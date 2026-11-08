import { defaultCardName, fillName, hasNamePlaceholder } from './phrase-card-name'

describe('fillName', () => {
  it('replaces every placeholder with the picked name', () => {
    expect(fillName('{name} มีการจองไว้ ({name})', 'Alex Demo')).toBe(
      'Alex Demo มีการจองไว้ (Alex Demo)'
    )
  })

  it('keeps the placeholder when no name is picked', () => {
    expect(fillName('Reservation under {name}', '  ')).toBe('Reservation under {name}')
  })

  it('leaves a text without placeholder alone, and a name is taken literally', () => {
    expect(fillName('Hello', 'Alex')).toBe('Hello')
    expect(fillName('Under {name}', '$& <b>')).toBe('Under $& <b>')
  })

  it('tells which texts carry the placeholder', () => {
    expect(hasNamePlaceholder('Under {name}')).toBe(true)
    expect(hasNamePlaceholder('Hello')).toBe(false)
    expect(hasNamePlaceholder(null)).toBe(false)
  })
})

describe('defaultCardName', () => {
  const travellers = [
    { userId: 'u-partner', displayName: 'Partner Demo' },
    { userId: 'u-me', displayName: 'Owner Demo' },
    { userId: null, displayName: 'Guest Demo' },
  ]

  it('starts with the traveller’s own row on the trip', () => {
    expect(defaultCardName(travellers, 'u-me', 'Account Name')).toBe('Owner Demo')
  })

  it('falls back to the account name, then to the first traveller', () => {
    expect(defaultCardName(travellers, 'u-other', 'Account Name')).toBe('Account Name')
    expect(defaultCardName(travellers, null, null)).toBe('Partner Demo')
    expect(defaultCardName([], null, null)).toBe('')
  })
})
