import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  InjectionToken,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core'
import type * as MapLibre from 'maplibre-gl'
import { MkWorldMapComponent, type MapPlace, type MapRoute } from '../world-map/world-map.component'
import { worldViewBox } from '../world-map/world-projection'

export type MapLibreModule = typeof MapLibre

/** MapLibre GL JS and the URLs of the worker and stylesheet it needs beside it. */
export interface MapLibreBundle {
  maplibre: MapLibreModule
  workerUrl: string
  cssUrl: string
}

/**
 * Loads MapLibre GL JS from its hashed file under media/ (never a root chunk
 * the service worker would prefetch, never in the initial bundle). Tests swap it.
 */
export const MAPLIBRE_LOADER = new InjectionToken<() => Promise<MapLibreBundle>>(
  'MAPLIBRE_LOADER',
  {
    providedIn: 'root',
    factory: () => {
      const document = inject(DOCUMENT)
      return async () => {
        const assets = await import('./maplibre-assets')
        const url = new URL(assets.libraryUrl, document.baseURI).href
        const maplibre = (await import(/* @vite-ignore */ url)) as MapLibreModule
        return { maplibre, workerUrl: assets.workerUrl, cssUrl: assets.cssUrl }
      }
    },
  }
)

/**
 * The keyless vector style (OpenFreeMap "liberty", OpenMapTiles schema):
 * fetched at runtime only, never bundled. Tests swap the fetcher.
 */
export const MAP_STYLE_URL = new InjectionToken<string>('MAP_STYLE_URL', {
  providedIn: 'root',
  factory: () => 'https://tiles.openfreemap.org/styles/liberty',
})

/** Fetches the style document; rejects when the tile provider cannot be reached in time. */
export const MAP_STYLE_FETCHER = new InjectionToken<(url: string) => Promise<unknown>>(
  'MAP_STYLE_FETCHER',
  {
    providedIn: 'root',
    factory: () => async (url: string) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(STYLE_TIMEOUT_MS) })
      if (!response.ok) {
        throw new Error(`map style answered ${response.status}`)
      }
      return response.json()
    },
  }
)

const STYLE_TIMEOUT_MS = 6000
/** The vector map gets this long to draw its first frame before the SVG view stays. */
const LOAD_TIMEOUT_MS = 12000

export type MapMode = 'fallback' | 'loading' | 'map'

/**
 * `<mk-map [places] [routes] [countries] [online] [label]>`: the map of
 * where we have been. Online it loads MapLibre GL JS (lazily) with the
 * keyless OpenFreeMap vector style: visited countries highlighted by their
 * label, a route line per trip and a pin per city in the trip's series
 * colour, read from the tokens at runtime. Until that map has drawn, and
 * for good whenever it cannot (offline, the provider unreachable, no
 * WebGL), the pure-SVG `mk-world-map` stands in, so the page never breaks.
 * `data-mode` says which one shows.
 */
@Component({
  selector: 'mk-map',
  imports: [MkWorldMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-map', '[attr.data-mode]': 'mode()' },
  styles: `
    :host {
      position: relative;
      display: block;
      width: 100%;
    }
    .mk-map__canvas {
      position: absolute;
      inset: 0;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      visibility: hidden;
    }
    :host([data-mode='map']) .mk-map__canvas {
      visibility: visible;
    }
    :host([data-mode='map']) mk-world-map {
      visibility: hidden;
    }
  `,
  template: `
    <mk-world-map [places]="places()" [routes]="routes()" [label]="label()" />
    <div #canvas class="mk-map__canvas" aria-hidden="true"></div>
  `,
})
export class MkMapComponent {
  readonly places = input.required<readonly MapPlace[]>()
  readonly routes = input<readonly MapRoute[]>([])
  /** ISO 3166-1 alpha-2 codes of the visited countries. */
  readonly countries = input<readonly string[]>([])
  /** False: never reach for the tiles, the SVG view stays. */
  readonly online = input(true)
  readonly label = input.required<string>()

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef)
  private readonly document = inject(DOCUMENT)
  private readonly loadMapLibre = inject(MAPLIBRE_LOADER)
  private readonly fetchStyle = inject(MAP_STYLE_FETCHER)
  private readonly styleUrl = inject(MAP_STYLE_URL)
  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas')

  protected readonly mode = signal<MapMode>('fallback')
  private map: MapLibre.Map | null = null
  private attempted = false
  private readonly rendered = signal(false)
  private destroyed = false

  private readonly data = computed(() => ({
    places: this.places(),
    routes: this.routes(),
    countries: this.countries(),
  }))

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true
      this.map?.remove()
      this.map = null
    })
    afterNextRender(() => this.rendered.set(true))
    effect(() => {
      if (this.rendered() && this.online() && !this.attempted) {
        this.attempted = true
        void untracked(() => this.load())
      }
    })
    effect(() => {
      const data = this.data()
      if (this.mode() === 'map') {
        untracked(() => this.paint(data))
      }
    })
  }

  private async load(): Promise<void> {
    this.mode.set('loading')
    try {
      const style = await this.fetchStyle(this.styleUrl)
      const { maplibre, workerUrl, cssUrl } = await this.loadMapLibre()
      if (this.destroyed) {
        return
      }
      this.linkStylesheet(cssUrl)
      maplibre.setWorkerUrl(new URL(workerUrl, this.document.baseURI).href)
      const map = new maplibre.Map({
        container: this.canvas().nativeElement,
        style: style as MapLibre.StyleSpecification,
        bounds: this.bounds(),
        attributionControl: { compact: true },
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
      })
      this.map = map
      const timer = setTimeout(() => this.giveUp(), LOAD_TIMEOUT_MS)
      map.once('error', () => {
        if (this.mode() !== 'map') {
          clearTimeout(timer)
          this.giveUp()
        }
      })
      map.once('load', () => {
        clearTimeout(timer)
        if (this.destroyed || this.map !== map) {
          return
        }
        this.addLayers(map)
        this.mode.set('map')
      })
    } catch {
      this.giveUp()
    }
  }

  private giveUp(): void {
    this.map?.remove()
    this.map = null
    this.mode.set('fallback')
  }

  private linkStylesheet(href: string): void {
    if (this.document.querySelector('link[data-maplibre]')) {
      return
    }
    const link = this.document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.setAttribute('data-maplibre', '')
    this.document.head.appendChild(link)
  }

  /** `[[west, south], [east, north]]` around the places, from the SVG view's framing. */
  private bounds(): [[number, number], [number, number]] {
    const box = worldViewBox(this.places())
    return [
      [box.x - 180, 90 - (box.y + box.height)],
      [box.x + box.width - 180, 90 - box.y],
    ]
  }

  /** A token's value, resolved where the map sits (theme included). */
  private token(name: string): string {
    return getComputedStyle(this.host.nativeElement).getPropertyValue(name).trim()
  }

  private addLayers(map: MapLibre.Map): void {
    const sources = this.sources(this.data())
    map.addSource('mk-routes', { type: 'geojson', data: sources.routes })
    map.addSource('mk-places', { type: 'geojson', data: sources.places })
    map.addLayer({
      'id': 'mk-countries',
      'type': 'symbol',
      'source': 'openmaptiles',
      'source-layer': 'place',
      'filter': this.countryFilter(this.countries()),
      'layout': {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': ['Noto Sans Bold'],
        'text-size': 15,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.1,
      },
      'paint': {
        'text-color': this.token('--stamp-ink'),
        'text-halo-color': this.token('--surface-1'),
        'text-halo-width': 2,
      },
    })
    map.addLayer({
      id: 'mk-routes',
      type: 'line',
      source: 'mk-routes',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'colour'], 'line-width': 3, 'line-dasharray': [2, 1.5] },
    })
    map.addLayer({
      id: 'mk-places',
      type: 'circle',
      source: 'mk-places',
      paint: {
        'circle-radius': 6,
        'circle-color': ['get', 'fill'],
        'circle-stroke-color': ['get', 'colour'],
        'circle-stroke-width': 2,
      },
    })
  }

  private countryFilter(codes: readonly string[]): MapLibre.FilterSpecification {
    return [
      'all',
      ['==', ['get', 'class'], 'country'],
      ['in', ['get', 'iso_a2'], ['literal', [...codes]]],
    ]
  }

  private sources(data: { places: readonly MapPlace[]; routes: readonly MapRoute[] }) {
    const surface = this.token('--surface-1')
    const colour = (series: number) => this.token(`--series-${series}`)
    return {
      places: {
        type: 'FeatureCollection' as const,
        features: data.places.map((place) => ({
          type: 'Feature' as const,
          properties: {
            label: place.label,
            colour: colour(place.series),
            fill: place.earned ? colour(place.series) : surface,
          },
          geometry: { type: 'Point' as const, coordinates: [place.lng, place.lat] },
        })),
      },
      routes: {
        type: 'FeatureCollection' as const,
        features: data.routes
          .filter((route) => route.points.length > 1)
          .map((route) => ({
            type: 'Feature' as const,
            properties: { colour: colour(route.series) },
            geometry: {
              type: 'LineString' as const,
              coordinates: route.points.map((point) => [point.lng, point.lat]),
            },
          })),
      },
    }
  }

  /** Keeps the drawn map in step with the live data. */
  private paint(data: {
    places: readonly MapPlace[]
    routes: readonly MapRoute[]
    countries: readonly string[]
  }): void {
    const map = this.map
    if (!map) {
      return
    }
    const sources = this.sources(data)
    ;(map.getSource('mk-places') as MapLibre.GeoJSONSource | undefined)?.setData(sources.places)
    ;(map.getSource('mk-routes') as MapLibre.GeoJSONSource | undefined)?.setData(sources.routes)
    if (map.getLayer('mk-countries')) {
      map.setFilter('mk-countries', this.countryFilter(data.countries))
    }
  }
}
