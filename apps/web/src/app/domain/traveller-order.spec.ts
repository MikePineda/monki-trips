import { byTravellerOrder } from './traveller-order'

const traveller = (id: string, position: number, createdAt?: string, updatedAt = 'z') => ({
  id,
  position,
  createdAt,
  updatedAt,
})

describe('traveller order', () => {
  it('ties on position follow creation, like the server', () => {
    const rows = [
      traveller('late', 0, '2026-11-07T12:00:00.000Z'),
      traveller('second', 1, '2026-11-07T09:00:00.000Z'),
      traveller('early', 0, '2026-11-07T08:00:00.000Z'),
    ]

    expect([...rows].sort(byTravellerOrder).map((row) => row.id)).toEqual([
      'early',
      'late',
      'second',
    ])
  })

  it('a traveller made on this device and not synced yet counts from its last change', () => {
    const rows = [
      traveller('local', 0, undefined, '2026-11-07T07:00:00.000Z'),
      traveller('synced', 0, '2026-11-07T08:00:00.000Z'),
    ]

    expect([...rows].sort(byTravellerOrder).map((row) => row.id)).toEqual(['local', 'synced'])
  })
})
