import { telHref } from './tel-href'

describe('telHref', () => {
  it('keeps the digits and a leading plus', () => {
    expect(telHref('+1 555 0100')).toBe('tel:+15550100')
    expect(telHref('(02) 1234-5678')).toBe('tel:0212345678')
    expect(telHref('  112 ')).toBe('tel:112')
  })

  it('has nothing to dial for an empty or wordy value', () => {
    expect(telHref('')).toBeNull()
    expect(telHref(null)).toBeNull()
    expect(telHref('ask reception')).toBeNull()
  })
})
