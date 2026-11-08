import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { WORLD_LAND } from './world-land'
import { project, worldViewBox, type LngLat } from './world-projection'

/** A city on the map: the series colour is its trip's (`--series-1` … `--series-8`). */
export interface MapPlace extends LngLat {
  label: string
  series: number
  /** False for a place still coming up: drawn hollow. */
  earned: boolean
}

/** One trip's route, its places in itinerary order. */
export interface MapRoute {
  series: number
  points: readonly LngLat[]
}

/**
 * The offline world view: a pure-SVG plate carrée map that needs no tiles
 * and no network. A coarse land outline in `surface-2` on `surface-1`, the
 * graticule every 30° in `gridline`, a route line per trip and a dot per
 * city in the trip's series colour (hollow while coming up), framed around
 * the places. `mk-map` shows it whenever the vector map cannot load.
 */
@Component({
  selector: 'mk-world-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'mk-world-map',
    'role': 'img',
    '[attr.aria-label]': 'label()',
    '[attr.data-places]': 'places().length',
  },
  styles: `
    :host {
      display: block;
      width: 100%;
      aspect-ratio: 2 / 1;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--surface-1);
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .mk-world-map__land {
      fill: var(--surface-2);
      stroke: var(--line-strong);
      stroke-linejoin: round;
    }
    .mk-world-map__grid {
      fill: none;
      stroke: var(--gridline);
    }
    .mk-world-map__route {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .mk-world-map__place {
      stroke: var(--surface-1);
    }
  `,
  template: `
    <svg
      [attr.viewBox]="viewBox()"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <path class="mk-world-map__grid" [attr.d]="grid" [attr.stroke-width]="hairline()" />
      <path class="mk-world-map__land" [attr.d]="land" [attr.stroke-width]="hairline()" />
      @for (route of lines(); track $index) {
        <polyline
          class="mk-world-map__route"
          data-testid="mk-world-map.route"
          [attr.points]="route.points"
          [attr.stroke]="route.colour"
          [attr.stroke-width]="hairline() * 3"
          [attr.stroke-dasharray]="hairline() * 6 + ' ' + hairline() * 4"
        />
      }
      @for (place of dots(); track $index) {
        <circle
          class="mk-world-map__place"
          data-testid="mk-world-map.place"
          [attr.cx]="place.x"
          [attr.cy]="place.y"
          [attr.r]="hairline() * 6"
          [attr.fill]="place.earned ? place.colour : 'var(--surface-1)'"
          [attr.stroke]="place.earned ? null : place.colour"
          [attr.stroke-width]="hairline() * 2"
          [attr.data-earned]="place.earned ? '' : null"
        >
          <title>{{ place.label }}</title>
        </circle>
      }
    </svg>
  `,
})
export class MkWorldMapComponent {
  readonly places = input.required<readonly MapPlace[]>()
  readonly routes = input<readonly MapRoute[]>([])
  /** Accessible name of the picture. */
  readonly label = input.required<string>()

  protected readonly land = WORLD_LAND.map(
    (ring) =>
      `M${ring
        .map(([lng, lat]) => {
          const { x, y } = project({ lat, lng })
          return `${x} ${y}`
        })
        .join('L')}Z`
  ).join('')

  protected readonly grid = [
    ...[30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((x) => `M${x} 0V180`),
    ...[30, 60, 90, 120, 150].map((y) => `M0 ${y}H360`),
  ].join('')

  private readonly box = computed(() => worldViewBox(this.places()))
  protected readonly viewBox = computed(() => {
    const box = this.box()
    return `${box.x} ${box.y} ${box.width} ${box.height}`
  })
  /** One screen pixel or so, in map units, so lines keep their weight at any zoom. */
  protected readonly hairline = computed(() => Math.round((this.box().width / 360) * 1000) / 1000)

  protected readonly dots = computed(() =>
    this.places().map((place) => ({
      ...project(place),
      earned: place.earned,
      label: place.label,
      colour: `var(--series-${place.series})`,
    }))
  )
  protected readonly lines = computed(() =>
    this.routes()
      .filter((route) => route.points.length > 1)
      .map((route) => ({
        colour: `var(--series-${route.series})`,
        points: route.points
          .map((point) => {
            const { x, y } = project(point)
            return `${x},${y}`
          })
          .join(' '),
      }))
  )
}
