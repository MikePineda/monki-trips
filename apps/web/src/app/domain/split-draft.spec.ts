import { defaultSplit, splitShares } from './split-draft'

const TRAVELLERS = ['v1', 'v2', 'v3']

describe('split draft', () => {
  it('defaults to me paying and everyone sharing equally', () => {
    expect(defaultSplit(TRAVELLERS, 'v2')).toEqual({
      payerId: 'v2',
      participantIds: ['v1', 'v2', 'v3'],
      custom: null,
    })
  })

  it('falls back to the first traveller as payer when the device does not know me', () => {
    expect(defaultSplit(TRAVELLERS, null).payerId).toBe('v1')
  })

  it('an equal split adds up, the remainder on the payer, in traveller order', () => {
    const result = splitShares(
      1000,
      { payerId: 'v3', participantIds: ['v3', 'v1'], custom: null },
      TRAVELLERS
    )
    expect(result).toEqual({
      valid: true,
      remainingMinor: 0,
      shares: [
        { travellerId: 'v1', shareMinor: 500 },
        { travellerId: 'v3', shareMinor: 500 },
      ],
    })
    expect(
      splitShares(1001, { payerId: 'v3', participantIds: ['v1', 'v3'], custom: null }, TRAVELLERS)
        .shares
    ).toEqual([
      { travellerId: 'v1', shareMinor: 500 },
      { travellerId: 'v3', shareMinor: 501 },
    ])
  })

  it('custom amounts are valid only when they add up to the amount', () => {
    const draft = { payerId: 'v1', participantIds: ['v1', 'v2'], custom: { v1: 300, v2: 500 } }
    expect(splitShares(1000, draft, TRAVELLERS)).toMatchObject({
      valid: false,
      remainingMinor: 200,
    })
    expect(splitShares(800, draft, TRAVELLERS)).toEqual({
      valid: true,
      remainingMinor: 0,
      shares: [
        { travellerId: 'v1', shareMinor: 300 },
        { travellerId: 'v2', shareMinor: 500 },
      ],
    })
    expect(splitShares(700, draft, TRAVELLERS).remainingMinor).toBe(-100)
  })

  it('nobody sharing is never valid', () => {
    expect(
      splitShares(1000, { payerId: 'v1', participantIds: [], custom: null }, TRAVELLERS).valid
    ).toBe(false)
  })
})
