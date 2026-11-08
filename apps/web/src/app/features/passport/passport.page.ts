import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import type { CityStamp, CountryStamp } from '@monkitrips/shared'
import { intlLocale } from '../../core/i18n/intl-locale'
import { countKey } from '../../domain/count-key'
import { formatDayDate } from '../../domain/day-date'
import { regionName } from '../../domain/region-name'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkIconButtonComponent } from '../../shared/ui/icon-button/icon-button.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { stampArtworkName } from '../../shared/ui/stamp/stamp-artwork'
import { MkStampTileComponent } from '../../shared/ui/stamp/stamp-tile.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { passportData } from './passport-data'
import { providePassportI18n } from './passport-i18n'
import { StampDetailSheet, type StampDetailData } from './stamp-detail.sheet'

interface StampView {
  /** Artwork key: `XA` for a country, `XA-HARBOUR CITY` for a city. */
  code: string
  place: string
  stamp: CountryStamp | CityStamp
}

interface CountryPage extends StampView {
  cities: StampView[]
}

/**
 * The passport: a page per country, earned first, each with its stamp and
 * the stamps of its cities. A place counts once a stop there is behind us
 * or its trip is over; the ones coming up show faded with their planned
 * date. Tapping a stamp says when and on which trip. Drawn artwork under
 * `public/stamps/` wins; every other place gets a generated stamp. The map
 * of where we have been is one tap away.
 */
@Component({
  selector: 'app-passport-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    MkStackComponent,
    MkRowComponent,
    MkSectionComponent,
    MkTextComponent,
    MkButtonComponent,
    MkIconButtonComponent,
    MkIconComponent,
    MkEmptyStateComponent,
    MkStampTileComponent,
  ],
  providers: [providePassportI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="2">
      <mk-row gap="1" justify="between">
        <mk-row gap="1">
          <a
            mk-icon-button
            routerLink="/trips"
            [attr.aria-label]="'passport.back' | transloco"
            data-testid="passport.back"
          >
            <mk-icon name="arrow-left" />
          </a>
          <h1 mk-text variant="title">{{ 'passport.title' | transloco }}</h1>
        </mk-row>
        <a
          mk-button
          variant="secondary"
          size="sm"
          routerLink="/passport/map"
          data-testid="passport.openMap"
        >
          <mk-icon name="map" [size]="18" />
          {{ 'passport.view.map' | transloco }}
        </a>
      </mk-row>

      @if (pages().length === 0) {
        <mk-empty-state
          mascot="excited"
          [title]="'passport.empty.title' | transloco"
          [body]="'passport.empty.body' | transloco"
          data-testid="passport.empty"
        />
      } @else {
        <p mk-text variant="caption" tone="ink-2" data-testid="passport.summary">
          {{
            countKey('passport.summary.countries', earned().countries)
              | transloco: { count: earned().countries }
          }}
          ·
          {{
            countKey('passport.summary.cities', earned().cities)
              | transloco: { count: earned().cities }
          }}
        </p>
        @for (page of pages(); track page.code) {
          <mk-section
            [eyebrow]="page.place"
            data-testid="passport.country"
            [attr.data-code]="page.code"
          >
            <mk-stack gap="1" align="center">
              <mk-stamp-tile
                size="lg"
                [code]="page.code"
                [name]="page.place"
                [isoDate]="page.stamp.date"
                [arrivedBy]="page.stamp.arrivedBy"
                [reached]="page.stamp.earned"
                [pendingLabel]="'passport.comingUp' | transloco"
                [caption]="page.place"
                [meta]="meta(page)"
                [label]="
                  (page.stamp.earned ? 'passport.countryStamp' : 'passport.countryComingUp')
                    | transloco: { place: page.place, date: day(page.stamp.date) }
                "
                data-testid="passport.countryStamp"
                (pick)="open(page)"
              />
              @if (page.cities.length > 0) {
                <mk-row gap="1" justify="center" [wrap]="true" data-testid="passport.cities">
                  @for (city of page.cities; track city.code) {
                    <mk-stamp-tile
                      [code]="city.code"
                      [name]="city.place"
                      [isoDate]="city.stamp.date"
                      [arrivedBy]="city.stamp.arrivedBy"
                      [reached]="city.stamp.earned"
                      [pendingLabel]="'passport.comingUp' | transloco"
                      [caption]="city.place"
                      [meta]="meta(city)"
                      data-testid="passport.cityStamp"
                      (pick)="open(city)"
                    />
                  }
                </mk-row>
              }
            </mk-stack>
          </mk-section>
        }
      }
    </mk-stack>
  `,
})
export default class PassportPage {
  private readonly sheets = inject(SheetService)
  private readonly locale = intlLocale()
  private readonly data = passportData()

  protected readonly countKey = countKey

  protected readonly pages = computed<CountryPage[]>(() =>
    this.data.countries().map((country) => ({
      code: country.code,
      place: regionName(country.code, this.locale(), stampArtworkName(country.code)),
      stamp: country,
      cities: country.cities.map((city) => ({
        code: `${country.code}-${city.name.toLocaleUpperCase()}`,
        place: city.name,
        stamp: city,
      })),
    }))
  )

  /** What the passport holds today: earned countries and cities only. */
  protected readonly earned = computed(() => {
    const countries = this.data.countries().filter((country) => country.earned)
    return {
      countries: countries.length,
      cities: this.data
        .countries()
        .reduce((sum, country) => sum + country.cities.filter((city) => city.earned).length, 0),
    }
  })

  protected day(isoDate: string): string {
    return formatDayDate(isoDate, this.locale(), false, true)
  }

  protected meta(view: StampView): string {
    return this.day(view.stamp.date)
  }

  protected open(view: StampView): void {
    const data: StampDetailData = {
      code: view.code,
      place: view.place,
      earned: view.stamp.earned,
      isoDate: view.stamp.date,
      date: this.day(view.stamp.date),
      tripId: view.stamp.tripId,
      tripName: view.stamp.tripName,
      arrivedBy: view.stamp.arrivedBy,
      visits: view.stamp.visits.map((visit) => ({
        tripName: visit.tripName,
        date: this.day(visit.date),
        earned: visit.earned,
      })),
    }
    this.sheets.open(StampDetailSheet, { data, label: view.place })
  }
}
