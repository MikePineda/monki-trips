/**
 * The "Directions" link of a place: Apple Maps on iOS (the installed app
 * opens it), Google Maps directions everywhere else. Coordinates win over
 * the address, the address over the place name. Null when there is nowhere
 * to go. Pure.
 */
export type DirectionsPlatform = 'ios' | 'other'

export interface DirectionsDestination {
  lat?: number | null
  lng?: number | null
  address?: string | null
  placeName?: string | null
}

export function directionsDestination(place: DirectionsDestination): string | null {
  if (typeof place.lat === 'number' && typeof place.lng === 'number') {
    return `${place.lat},${place.lng}`
  }
  const text = place.address?.trim() || place.placeName?.trim()
  return text ? text : null
}

export function directionsUrl(
  platform: DirectionsPlatform,
  place: DirectionsDestination
): string | null {
  const destination = directionsDestination(place)
  if (!destination) {
    return null
  }
  const encoded = encodeURIComponent(destination)
  return platform === 'ios'
    ? `https://maps.apple.com/?daddr=${encoded}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
}
