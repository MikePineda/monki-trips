import { Component, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import type { MapPlace, MapRoute } from '../world-map/world-map.component'
import {
  MAPLIBRE_LOADER,
  MAP_STYLE_FETCHER,
  MkMapComponent,
  type MapLibreModule,
} from './map.component'

const PLACES: MapPlace[] = [
  { label: 'Harbour City', lat: 12.5, lng: 10, series: 1, earned: true },
  { label: 'Old Town', lat: 14, lng: 16, series: 1, earned: true },
  { label: 'Snow Peak', lat: 46, lng: 8, series: 2, earned: false },
]
const ROUTES: MapRoute[] = [{ series: 1, points: PLACES.slice(0, 2) }]

@Component({
  imports: [MkMapComponent],
  template: `
    <mk-map
      [places]="places"
      [routes]="routes"
      [countries]="['XA']"
      [online]="online()"
      label="Where we have been"
    />
  `,
})
class Host {
  readonly places = PLACES
  readonly routes = ROUTES
  readonly online = signal(true)
}

/** A stand-in for MapLibre: records the map it made and fires `load` (or `error`) on demand. */
function fakeMapLibre() {
  const made: FakeMap[] = []
  class FakeMap {
    readonly handlers = new Map<string, () => void>()
    readonly layers: string[] = []
    removed = false
    constructor(readonly options: { container: HTMLElement; bounds: unknown }) {
      made.push(this)
    }
    once(event: string, handler: () => void) {
      this.handlers.set(event, handler)
    }
    readonly sources: string[] = []
    addSource(id: string) {
      this.sources.push(id)
    }
    addLayer(layer: { id: string }) {
      this.layers.push(layer.id)
    }
    getSource() {
      return undefined
    }
    getLayer() {
      return undefined
    }
    remove() {
      this.removed = true
    }
  }
  const module = { Map: FakeMap, setWorkerUrl: vi.fn() } as unknown as MapLibreModule
  return { module, made }
}

describe('mk-map', () => {
  async function render(options: {
    online: boolean
    fetchStyle: () => Promise<unknown>
    maplibre?: MapLibreModule
  }) {
    const loader = vi.fn(async () => ({
      maplibre: options.maplibre ?? fakeMapLibre().module,
      workerUrl: 'media/maplibre-gl-worker-ABCD1234.mjs',
      cssUrl: 'media/maplibre-gl-ABCD1234.css',
    }))
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        { provide: MAPLIBRE_LOADER, useValue: loader },
        { provide: MAP_STYLE_FETCHER, useValue: vi.fn(options.fetchStyle) },
      ],
    })
    const fixture = TestBed.createComponent(Host)
    fixture.componentInstance.online.set(options.online)
    fixture.detectChanges()
    await fixture.whenStable()
    const map = fixture.nativeElement.querySelector('mk-map') as HTMLElement
    return { fixture, map, loader }
  }

  it('map falls back to the svg view offline', async () => {
    const fetchStyle = vi.fn(async () => ({}))
    const { map, loader } = await render({ online: false, fetchStyle })

    expect(map.getAttribute('data-mode')).toBe('fallback')
    const svgView = map.querySelector('mk-world-map')!
    expect(svgView.getAttribute('aria-label')).toBe('Where we have been')
    expect(svgView.querySelectorAll('[data-testid="mk-world-map.place"]')).toHaveLength(3)
    expect(svgView.querySelectorAll('[data-testid="mk-world-map.route"]')).toHaveLength(1)
    expect(loader).not.toHaveBeenCalled()
  })

  it('stays on the svg view when the tile provider cannot be reached, without loading MapLibre', async () => {
    const { map, loader } = await render({
      online: true,
      fetchStyle: async () => {
        throw new TypeError('Failed to fetch')
      },
    })

    await vi.waitFor(() => expect(map.getAttribute('data-mode')).toBe('fallback'))
    expect(loader).not.toHaveBeenCalled()
  })

  it('online it loads MapLibre lazily and shows the vector map once it has drawn', async () => {
    const fake = fakeMapLibre()
    const { map, fixture } = await render({
      online: true,
      fetchStyle: async () => ({ version: 8, sources: {}, layers: [] }),
      maplibre: fake.module,
    })

    await vi.waitFor(() => expect(fake.made).toHaveLength(1))
    expect(map.getAttribute('data-mode')).toBe('loading')
    expect(fake.module.setWorkerUrl).toHaveBeenCalledWith(
      expect.stringMatching(/\/media\/maplibre-gl-worker-ABCD1234\.mjs$/)
    )

    fake.made[0].handlers.get('load')!()
    fixture.detectChanges()

    expect(map.getAttribute('data-mode')).toBe('map')
    expect(fake.made[0].layers).toEqual(['mk-countries', 'mk-routes', 'mk-places'])
  })

  it('a map that fails before drawing gives way to the svg view', async () => {
    const fake = fakeMapLibre()
    const { map, fixture } = await render({
      online: true,
      fetchStyle: async () => ({ version: 8, sources: {}, layers: [] }),
      maplibre: fake.module,
    })
    await vi.waitFor(() => expect(fake.made).toHaveLength(1))

    fake.made[0].handlers.get('error')!()
    fixture.detectChanges()

    expect(map.getAttribute('data-mode')).toBe('fallback')
    expect(fake.made[0].removed).toBe(true)
  })

  it('draws only with tokens: no colour literal in the svg view', async () => {
    const { map } = await render({ online: false, fetchStyle: async () => ({}) })
    expect(map.outerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(map.querySelector('[data-testid="mk-world-map.place"]')?.getAttribute('fill')).toBe(
      'var(--series-1)'
    )
    expect(
      map.querySelectorAll('[data-testid="mk-world-map.place"]')[2].hasAttribute('data-earned')
    ).toBe(false)
  })
})
