import { OWNER_ONLY_TRIP_FIELDS, canEditTripField } from './owner-only-fields'

describe('canEditTripField', () => {
  it('editor cannot change the trip budget total if owner-only', () => {
    expect(canEditTripField('editor', 'budgetTotalMinor', ['budgetTotalMinor'])).toBe(false)
    expect(canEditTripField('owner', 'budgetTotalMinor', ['budgetTotalMinor'])).toBe(true)
  })

  it('follows the contract: only the base currency is owner-only, so an editor sets the budget', () => {
    expect(OWNER_ONLY_TRIP_FIELDS).toEqual(['baseCurrency'])
    expect(canEditTripField('editor', 'baseCurrency')).toBe(false)
    expect(canEditTripField('editor', 'budgetTotalMinor')).toBe(true)
    expect(canEditTripField('owner', 'baseCurrency')).toBe(true)
  })
})
