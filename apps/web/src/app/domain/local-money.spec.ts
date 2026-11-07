import { fromBaseMinor, localRate } from './local-money'

describe('local money', () => {
  it('the local currency is the country one, at the rate of its latest expense', () => {
    const expenses = [
      { currency: 'JPY', fxRate: '97.1', spentOn: '2027-01-20', updatedAt: 'a' },
      { currency: 'JPY', fxRate: '98.5', spentOn: '2027-01-22', updatedAt: 'a' },
      { currency: 'EUR', fxRate: '0.6', spentOn: '2027-01-23', updatedAt: 'a' },
      { currency: 'JPY', fxRate: null, spentOn: '2027-01-24', updatedAt: 'a' },
    ]

    expect(localRate(expenses, 'AUD', 'JP')).toEqual({ currency: 'JPY', rate: '98.5' })
  })

  it('no local amount without a known country, in the base country, or before any expense in it', () => {
    const expenses = [{ currency: 'EUR', fxRate: '0.6', spentOn: '2027-01-23', updatedAt: 'a' }]

    expect(localRate(expenses, 'AUD', 'XA')).toBeNull()
    expect(localRate(expenses, 'AUD', null)).toBeNull()
    expect(localRate(expenses, 'AUD', 'AU')).toBeNull()
    expect(localRate(expenses, 'AUD', 'JP')).toBeNull()
  })

  it('converts base minor units to a zero-decimal currency', () => {
    // A$205.00 at 98.5 yen per dollar is ¥20 192.5, rounded half to even.
    expect(fromBaseMinor(20_500n, 'AUD', { currency: 'JPY', rate: '98.5' })).toBe(20_192n)
  })

  it('keeps the sign of an amount over budget', () => {
    expect(fromBaseMinor(-1_000n, 'AUD', { currency: 'EUR', rate: '0.6' })).toBe(-600n)
  })
})
