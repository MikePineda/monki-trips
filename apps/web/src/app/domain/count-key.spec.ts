import { countKey } from './count-key'

describe('countKey', () => {
  it('picks the singular key for exactly one and the plural key otherwise', () => {
    expect(countKey('nights', 1)).toBe('nightsOne')
    expect(countKey('nights', 0)).toBe('nightsOther')
    expect(countKey('nights', 3)).toBe('nightsOther')
  })
})
