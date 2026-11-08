import { project, worldViewBox } from './world-projection'

describe('world projection', () => {
  it('puts longitude and latitude straight onto x and y, north up', () => {
    expect(project({ lat: 0, lng: 0 })).toEqual({ x: 180, y: 90 })
    expect(project({ lat: 90, lng: -180 })).toEqual({ x: 0, y: 0 })
    expect(project({ lat: -45, lng: 90 })).toEqual({ x: 270, y: 135 })
  })

  it('shows the whole world when there is nothing to frame', () => {
    expect(worldViewBox([])).toEqual({ x: 0, y: 0, width: 360, height: 180 })
  })

  it('frames the places with sea around them, 2:1, never tighter than 60 degrees', () => {
    const box = worldViewBox([
      { lat: 10, lng: 10 },
      { lat: 12, lng: 14 },
    ])
    expect(box.width).toBe(60)
    expect(box.height).toBe(30)
    expect(box.x).toBeLessThan(190)
    expect(box.x + box.width).toBeGreaterThan(194)
    expect(box.y).toBeLessThan(78)
    expect(box.y + box.height).toBeGreaterThan(80)
  })

  it('stays inside the world near its edges', () => {
    const box = worldViewBox([{ lat: 80, lng: 178 }])
    expect(box.x + box.width).toBeLessThanOrEqual(360)
    expect(box.y).toBeGreaterThanOrEqual(0)
  })
})
