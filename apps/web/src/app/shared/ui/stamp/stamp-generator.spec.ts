import { STAMP_SHAPES, stampDateText, stampDesign, stampSeed } from './stamp-generator'

/** Invented places only. */
const PLACES = [
  'Harbour City',
  'Old Town',
  'Hill Fort',
  'Snow Peak',
  'Xaloa',
  'Xebria',
  'Lantern Bay',
  'Copper Ridge',
  'Mistral Point',
  'Saltmarsh',
  'Juniper Falls',
  'Velvet Dunes',
]

describe('stamp generator', () => {
  it('stamp generator is deterministic for the same place and date', () => {
    const first = stampDesign({ place: 'Harbour City', date: '2026-05-02', arrivedBy: 'plane' })
    const again = stampDesign({ place: 'Harbour City', date: '2026-05-02', arrivedBy: 'plane' })

    expect(again).toEqual(first)
    expect(
      stampDesign({ place: '  harbour city ', date: '2026-05-02', arrivedBy: 'plane' })
    ).toEqual(first)
    expect(stampSeed('Harbour City', '2026-05-02')).toBe(stampSeed('Harbour City', '2026-05-02'))
    expect(stampSeed('Harbour City', '2026-05-02')).not.toBe(
      stampSeed('Harbour City', '2026-05-03')
    )
  })

  it('varies shape, ink and tilt across places', () => {
    const designs = PLACES.map((place) => stampDesign({ place, date: '2026-05-02' }))

    expect(new Set(designs.map((design) => design.shape))).toEqual(new Set(STAMP_SHAPES))
    expect(new Set(designs.map((design) => design.ink)).size).toBeGreaterThanOrEqual(3)
    expect(new Set(designs.map((design) => design.rotation)).size).toBeGreaterThanOrEqual(6)
    for (const design of designs) {
      expect(Math.abs(design.rotation)).toBeLessThanOrEqual(8)
      expect([1, 2, 3, 4]).toContain(design.ink)
    }
  })

  it('draws a double ring: an outline and an inner line of the same shape', () => {
    for (const place of PLACES) {
      const design = stampDesign({ place, date: '2026-05-02' })
      expect(design.outline).toMatch(/^M[\d.\s-]/)
      expect(design.inner).toMatch(/^M[\d.\s-]/)
      expect(design.inner).not.toBe(design.outline)
    }
  })

  it('curves the place along the top of round stamps and sets it straight on the others', () => {
    for (const place of PLACES) {
      const design = stampDesign({ place, date: '2026-05-02' })
      if (design.shape === 'circle' || design.shape === 'oval') {
        expect(design.textArc).toMatch(/^M[\d.\s-]+A/)
      } else {
        expect(design.textArc).toBeNull()
      }
    }
  })

  it('prints the place in caps, the date day first and the code', () => {
    const design = stampDesign({ place: 'Lantern Bay', code: 'XA', date: '2026-05-02' })

    expect(design.placeText).toBe('LANTERN BAY')
    expect(design.dateText).toBe('02.05.2026')
    expect(design.codeText).toBe('XA')
    expect(stampDateText('2027-01-20')).toBe('20.01.2027')
    expect(stampDesign({ place: 'Lantern Bay', label: '2 MAY' }).dateText).toBe('2 MAY')
  })

  it('fits a long name inside the stamp instead of running past the ring', () => {
    const design = stampDesign({
      place: 'The Very Long Lagoon Of Seven Bridges',
      date: '2026-05-02',
    })
    expect(design.placeFit).toBeGreaterThan(0)
    expect(stampDesign({ place: 'Saltmarsh', date: '2026-05-02' }).placeFit).toBeNull()
  })

  it('picks the icon from how they arrived', () => {
    expect(stampDesign({ place: 'Old Town', arrivedBy: 'plane' }).icon).toBe('plane')
    expect(stampDesign({ place: 'Old Town', arrivedBy: 'train' }).icon).toBe('train')
    expect(stampDesign({ place: 'Old Town', arrivedBy: 'boat' }).icon).toBe('boat')
    expect(stampDesign({ place: 'Old Town', arrivedBy: 'road' }).icon).toBe('road')
    expect(stampDesign({ place: 'Old Town' }).icon).toBe('star')
  })

  it('stamps use only stamp tokens', () => {
    for (const place of PLACES) {
      const design = stampDesign({ place, date: '2026-05-02', arrivedBy: 'boat' })
      const serialised = JSON.stringify(design)
      expect(serialised).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(serialised).not.toMatch(/rgb|hsl/i)
      expect(design.inkVar).toBe(`var(--stamp-ink-${design.ink})`)
    }
  })

  it('seeds the ink texture so it never changes between renders', () => {
    const design = stampDesign({ place: 'Saltmarsh', date: '2026-05-02' })
    expect(design.texture.seed).toBe(
      stampDesign({ place: 'Saltmarsh', date: '2026-05-02' }).texture.seed
    )
    expect(design.texture.frequency).toBeGreaterThan(0)
  })
})
