import { directionsUrl } from './directions-link'

describe('directions link', () => {
  it('directions link follows the platform', () => {
    const place = { address: '14 Quay Lane, Aldermoor' }

    expect(directionsUrl('ios', place)).toBe(
      'https://maps.apple.com/?daddr=14%20Quay%20Lane%2C%20Aldermoor'
    )
    expect(directionsUrl('other', place)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=14%20Quay%20Lane%2C%20Aldermoor'
    )
  })

  it('prefers coordinates, then the address, then the place name', () => {
    expect(directionsUrl('other', { lat: 12.5, lng: -3.25, address: 'x' })).toContain(
      'destination=12.5%2C-3.25'
    )
    expect(directionsUrl('other', { placeName: 'Harbour Inn' })).toContain('Harbour%20Inn')
    expect(directionsUrl('other', { address: '  ', placeName: null })).toBeNull()
  })
})
