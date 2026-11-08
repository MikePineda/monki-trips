import { translateUrl } from './translate-link'

describe('translateUrl', () => {
  it('opens Google Translate with the language pair', () => {
    expect(translateUrl('en', 'th')).toBe('https://translate.google.com/?sl=en&tl=th&op=translate')
  })

  it('uses the codes Google expects for Chinese scripts and regional tags', () => {
    expect(translateUrl('es-MX', 'zh-Hant')).toBe(
      'https://translate.google.com/?sl=es&tl=zh-TW&op=translate'
    )
    expect(translateUrl('en', 'pt-BR')).toBe(
      'https://translate.google.com/?sl=en&tl=pt&op=translate'
    )
  })
})
