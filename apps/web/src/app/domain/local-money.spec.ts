import { fromBaseMinor, localRate } from './local-money'

describe('local money', () => {
  it('the local currency is the latest foreign expense with a frozen rate', () => {
    expect(
      localRate(
        [
          { currency: 'EUR', fxRate: '0.6', spentOn: '2027-01-20', updatedAt: 'a' },
          { currency: 'JPY', fxRate: '98.5', spentOn: '2027-01-22', updatedAt: 'a' },
          { currency: 'THB', fxRate: null, spentOn: '2027-01-23', updatedAt: 'a' },
          { currency: 'AUD', fxRate: '1', spentOn: '2027-01-24', updatedAt: 'a' },
        ],
        'AUD'
      )
    ).toEqual({ currency: 'JPY', rate: '98.5' })
  })

  it('no foreign expense means no local amount', () => {
    expect(localRate([], 'AUD')).toBeNull()
  })

  it('converts base minor units to a zero-decimal currency', () => {
    // A$205.00 at 98.5 yen per dollar is ¥20 192.5, rounded half to even.
    expect(fromBaseMinor(20_500n, 'AUD', { currency: 'JPY', rate: '98.5' })).toBe(20_192n)
  })

  it('keeps the sign of an amount over budget', () => {
    expect(fromBaseMinor(-1_000n, 'AUD', { currency: 'EUR', rate: '0.6' })).toBe(-600n)
  })
})
