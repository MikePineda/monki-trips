/**
 * The plate carrée (equirectangular) projection of the offline world view:
 * longitude and latitude straight onto x and y in a 360 × 180 box, north up.
 * `worldViewBox` frames the given places with some sea around them, never
 * tighter than 60° × 30°, at 2:1, inside the world. Pure.
 */
export interface LngLat {
  lat: number
  lng: number
}

export const WORLD_WIDTH = 360
export const WORLD_HEIGHT = 180

export function project(point: LngLat): { x: number; y: number } {
  return { x: round(point.lng + 180), y: round(90 - point.lat) }
}

export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

const MIN_WIDTH = 120

export function worldViewBox(points: readonly LngLat[]): ViewBox {
  if (points.length === 0) {
    return { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT }
  }
  const projected = points.map(project)
  const xs = projected.map((point) => point.x)
  const ys = projected.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  // A quarter of the span as margin, at least 10°.
  const margin = Math.max(10, (maxX - minX) / 4, (maxY - minY) / 4)
  let width = Math.max(MIN_WIDTH, maxX - minX + 2 * margin, 2 * (maxY - minY + 2 * margin))
  width = Math.min(WORLD_WIDTH, width)
  const height = width / 2
  const x = clamp((minX + maxX) / 2 - width / 2, 0, WORLD_WIDTH - width)
  const y = clamp((minY + maxY) / 2 - height / 2, 0, WORLD_HEIGHT - height)
  return { x: round(x), y: round(y), width: round(width), height: round(height) }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
