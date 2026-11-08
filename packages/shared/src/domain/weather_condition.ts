/**
 * The few weather conditions the app draws, each with its own icon and
 * words, and the mapping from the WMO weather interpretation codes that
 * Open-Meteo answers (`weather_code`).
 */
export const WEATHER_CONDITIONS = [
  'clear',
  'partly_cloudy',
  'cloudy',
  'fog',
  'drizzle',
  'rain',
  'thunderstorm',
  'snow',
] as const

export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number]

const BY_CODE: ReadonlyMap<number, WeatherCondition> = new Map([
  [0, 'clear'],
  [1, 'clear'],
  [2, 'partly_cloudy'],
  [3, 'cloudy'],
  [45, 'fog'],
  [48, 'fog'],
  [51, 'drizzle'],
  [53, 'drizzle'],
  [55, 'drizzle'],
  [56, 'drizzle'],
  [57, 'drizzle'],
  [61, 'rain'],
  [63, 'rain'],
  [65, 'rain'],
  [66, 'rain'],
  [67, 'rain'],
  [80, 'rain'],
  [81, 'rain'],
  [82, 'rain'],
  [71, 'snow'],
  [73, 'snow'],
  [75, 'snow'],
  [77, 'snow'],
  [85, 'snow'],
  [86, 'snow'],
  [95, 'thunderstorm'],
  [96, 'thunderstorm'],
  [99, 'thunderstorm'],
])

/** The condition of a WMO code; an unknown code reads as `cloudy`. */
export function weatherCondition(code: number): WeatherCondition {
  return BY_CODE.get(code) ?? 'cloudy'
}
