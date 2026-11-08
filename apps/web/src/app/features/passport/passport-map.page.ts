import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { sortedStops } from '@monkitrips/shared'
import { OnlineStore } from '../../core/offline/online.store'
import { tripSeries } from '../../domain/travel-history'
import { MkBannerComponent } from '../../shared/ui/banner/banner.component'
import { MkIconButtonComponent } from '../../shared/ui/icon-button/icon-button.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkMapLegendComponent, type MapLegendItem } from '../../shared/ui/map/map-legend.component'
import { MkMapComponent } from '../../shared/ui/map/map.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import type { MapPlace, MapRoute } from '../../shared/ui/world-map/world-map.component'
import { passportData } from './passport-data'
import { providePassportI18n } from './passport-i18n'

/**
 * The map of where we have been: visited countries highlighted, a pin per
 * city in its trip's colour (hollow while coming up) and a route line per
 * trip, from the stops' coordinates on the device. The vector map needs
 * the network; offline (or when the tiles do not answer) the plain SVG
 * world view stands in and a calm banner says why.
 */
@Component({
  selector: 'app-passport-map-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    MkStackComponent,
    MkRowComponent,
    MkSectionComponent,
    MkTextComponent,
    MkBannerComponent,
    MkIconButtonComponent,
    MkIconComponent,
    MkMapComponent,
    MkMapLegendComponent,
  ],
  providers: [providePassportI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="2">
      <mk-row gap="1">
        <a
          mk-icon-button
          routerLink="/passport"
          [attr.aria-label]="'passport.title' | transloco"
          data-testid="passport.map.back"
        >
          <mk-icon name="arrow-left" />
        </a>
        <h1 mk-text variant="title">{{ 'passport.map.title' | transloco }}</h1>
      </mk-row>
      @if (!online()) {
        <mk-banner
          icon="wifi-off"
          [title]="'passport.map.offline' | transloco"
          data-testid="passport.map.offline"
        />
      }
      <mk-map
        [places]="places()"
        [routes]="routes()"
        [countries]="countries()"
        [online]="online()"
        [label]="'passport.map.label' | transloco: { places: placeNames() }"
        data-testid="passport.map"
      />
      @if (places().length === 0) {
        <p mk-text variant="caption" tone="ink-3" data-testid="passport.map.noPlaces">
          {{ 'passport.map.noPlaces' | transloco }}
        </p>
      }
      @if (legend().length > 0) {
        <mk-section [eyebrow]="'passport.map.legend' | transloco">
          <mk-map-legend [items]="legend()" data-testid="passport.map.legend" />
        </mk-section>
      }
    </mk-stack>
  `,
})
export default class PassportMapPage {
  protected readonly online = inject(OnlineStore).online
  private readonly data = passportData()

  private readonly series = computed(() => tripSeries(this.data.records().trips))

  protected readonly places = computed<MapPlace[]>(() =>
    this.data.countries().flatMap((country) =>
      country.cities.flatMap((city) =>
        city.coordinates
          ? [
              {
                ...city.coordinates,
                label: city.name,
                series: this.series().get(city.tripId) ?? 1,
                earned: city.earned,
              },
            ]
          : []
      )
    )
  )
  protected readonly placeNames = computed(() =>
    this.places()
      .map((place) => place.label)
      .join(', ')
  )

  protected readonly countries = computed(() =>
    this.data
      .countries()
      .filter((country) => country.earned)
      .map((country) => country.code)
  )

  protected readonly routes = computed<MapRoute[]>(() => {
    const { trips, stops } = this.data.records()
    return trips.map((trip) => ({
      series: this.series().get(trip.id) ?? 1,
      points: sortedStops(stops.filter((stop) => stop.tripId === trip.id)).flatMap((stop) =>
        stop.lat !== null && stop.lng !== null ? [{ lat: stop.lat, lng: stop.lng }] : []
      ),
    }))
  })

  protected readonly legend = computed<MapLegendItem[]>(() => {
    const { trips, stops } = this.data.records()
    const mapped = new Set(stops.filter((stop) => stop.lat !== null).map((stop) => stop.tripId))
    return [...trips]
      .filter((trip) => mapped.has(trip.id))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((trip) => ({
        label: trip.name,
        series: this.series().get(trip.id) ?? 1,
        meta: trip.startDate.slice(0, 7),
      }))
  })
}
