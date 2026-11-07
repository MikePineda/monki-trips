import { contrastRatio, parseCssColor, relativeLuminance } from './contrast'

describe('contrast', () => {
  it('parses hex and rgb() colours the browser hands back', () => {
    expect(parseCssColor('#B5470C')).toEqual({ r: 181, g: 71, b: 12 })
    expect(parseCssColor('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseCssColor('#1114174D')).toEqual({ r: 17, g: 20, b: 23 })
    expect(parseCssColor('rgb(245, 245, 242)')).toEqual({ r: 245, g: 245, b: 242 })
    expect(parseCssColor('rgba(15, 17, 19, 0.5)')).toEqual({ r: 15, g: 17, b: 19 })
    expect(parseCssColor('var(--surface-0)')).toBeNull()
    expect(parseCssColor('')).toBeNull()
  })

  it('black on white is 21:1 and a colour against itself is 1:1', () => {
    const black = { r: 0, g: 0, b: 0 }
    const white = { r: 255, g: 255, b: 255 }

    expect(relativeLuminance(white)).toBe(1)
    expect(contrastRatio(black, white)).toBe(21)
    expect(contrastRatio(white, black)).toBe(21)
    expect(contrastRatio(white, white)).toBe(1)
  })

  it('reproduces the design system ratios: accent on surface-0 is 4.97:1 light', () => {
    const accent = parseCssColor('#B5470C')!
    const surface = parseCssColor('#F5F5F2')!

    expect(contrastRatio(accent, surface)).toBeCloseTo(4.97, 2)
    expect(contrastRatio(parseCssColor('#F08A4B')!, parseCssColor('#0F1113')!)).toBeCloseTo(7.61, 2)
  })
})
