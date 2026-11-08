import { Dialog } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { provideRouter, Router } from '@angular/router'
import { TranslocoService } from '@jsverse/transloco'
import { blankEvent, blankStop } from '../../../testing/fake-trip-content'
import { SCOPE_CATALOGUES } from '../../../testing/i18n-scopes'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle } from '../../../testing/settle'
import type { MonkiTripsDb } from '../../core/offline/db'
import PassportPage from './passport.page'

/** TEST_NOW is 2026-11-07. Invented places only. */
const PAST = {
  id: 'past',
  name: 'Island hop',
  startDate: '2026-05-01',
  endDate: '2026-05-10',
  baseCurrency: 'EUR',
  updatedAt: '2026-11-07T00:00:00.000Z',
}
const ONGOING = {
  ...PAST,
  id: 'now',
  name: 'Long loop',
  startDate: '2026-11-01',
  endDate: '2026-11-20',
}

describe('PassportPage', () => {
  let db: MonkiTripsDb

  beforeEach(() => {
    db = freshOfflineDb()
    TestBed.configureTestingModule({
      imports: [PassportPage, i18nTesting()],
      providers: [...provideOfflineTesting({ db }), provideRouter([])],
    })
  })

  afterEach(async () => {
    TestBed.inject(Dialog).closeAll()
    await resetOfflineTesting(db)
  })

  async function render(expectCountries: number) {
    const fixture = TestBed.createComponent(PassportPage)
    fixture.detectChanges()
    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(
        fixture.nativeElement.querySelectorAll('[data-testid="passport.country"]')
      ).toHaveLength(expectCountries)
    })
    return { fixture, host: fixture.nativeElement as HTMLElement }
  }

  async function seed() {
    await db.trips.bulkPut([PAST, ONGOING])
    await db.stops.bulkPut([
      blankStop({
        id: 'a',
        tripId: 'past',
        position: 0,
        name: 'Harbour City',
        countryCode: 'XA',
        arriveOn: '2026-05-01',
        departOn: '2026-05-05',
      }),
      blankStop({
        id: 'b',
        tripId: 'past',
        position: 1,
        name: 'Old Town',
        countryCode: 'XC',
        arriveOn: '2026-05-05',
        departOn: '2026-05-10',
      }),
      blankStop({
        id: 'c',
        tripId: 'now',
        position: 0,
        name: 'Lantern Bay',
        countryCode: 'XC',
        arriveOn: '2026-11-01',
        departOn: '2026-11-05',
      }),
      blankStop({
        id: 'd',
        tripId: 'now',
        position: 1,
        name: 'Snow Peak',
        countryCode: 'XD',
        arriveOn: '2026-11-05',
        departOn: '2026-11-20',
      }),
    ])
    await db.events.put(
      blankEvent({
        id: 'train',
        tripId: 'past',
        kind: 'train',
        status: 'paid',
        startsOn: '2026-05-05',
        endsLocal: '2026-05-05T15:00:00',
      })
    )
  }

  it('says the passport is empty until a trip has stops', async () => {
    const { host } = await render(0)
    expect(host.querySelector('[data-testid="passport.empty"]')?.textContent).toContain(
      SCOPE_CATALOGUES.passport.en.empty.title
    )
    expect(host.querySelector('[data-testid="passport.openMap"]')?.getAttribute('href')).toBe(
      '/passport/map'
    )
  })

  it('a page per country with its stamp and its cities, earned first', async () => {
    await seed()
    const { host } = await render(3)

    const pages = [...host.querySelectorAll('[data-testid="passport.country"]')]
    expect(pages.map((page) => page.getAttribute('data-code'))).toEqual(['XA', 'XC', 'XD'])
    expect(
      pages[0]
        .querySelector('[data-testid="passport.countryStamp"] mk-stamp')
        ?.getAttribute('data-artwork')
    ).toBe('XA')
    expect(pages[0].textContent).toContain('Xaloa')
    const cities = [...pages[1].querySelectorAll('[data-testid="passport.cityStamp"]')]
    expect(
      cities.map((city) => city.querySelector('mk-stamp')?.getAttribute('aria-label'))
    ).toEqual(['Old Town', 'Lantern Bay'])
    expect(cities[0].querySelector('mk-stamp')?.getAttribute('data-icon')).toBe('train')
    expect(
      host
        .querySelector('[data-testid="passport.summary"]')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim()
    ).toBe('2 countries · 3 cities')
  })

  it('upcoming stamps show faded', async () => {
    await seed()
    const { host } = await render(3)
    const coming = host.querySelector('[data-testid="passport.country"][data-code="XD"]')!
    const stamp = coming.querySelector('[data-testid="passport.countryStamp"]')!

    expect(stamp.getAttribute('data-state')).toBe('upcoming')
    const drawn = stamp.querySelector('mk-stamp')!
    expect(drawn.hasAttribute('data-reached')).toBe(false)
    expect(drawn.querySelector('.mk-stamp__ring')?.getAttribute('stroke-dasharray')).toBe('6 5')
    expect(drawn.querySelector('.mk-stamp__code')?.textContent?.trim()).toBe(
      SCOPE_CATALOGUES.passport.en.comingUp
    )
    expect(stamp.querySelector('button')?.getAttribute('aria-label')).toContain('coming up')
  })

  it('a city counts once its stop is past: leaving today is not yet', async () => {
    await seed()
    const { host } = await render(3)
    const xc = host.querySelector('[data-testid="passport.country"][data-code="XC"]')!
    const states = [...xc.querySelectorAll('[data-testid="passport.cityStamp"]')].map((city) =>
      city.getAttribute('data-state')
    )
    expect(states).toEqual(['earned', 'earned'])

    await db.stops.put(
      blankStop({
        id: 'c',
        tripId: 'now',
        position: 0,
        name: 'Lantern Bay',
        countryCode: 'XC',
        arriveOn: '2026-11-01',
        departOn: '2026-11-07',
      })
    )
    await vi.waitFor(() => {
      TestBed.inject(Router)
      const lantern = [...host.querySelectorAll('[data-testid="passport.cityStamp"]')].find(
        (city) => city.querySelector('mk-stamp')?.getAttribute('aria-label') === 'Lantern Bay'
      )
      expect(lantern?.getAttribute('data-state')).toBe('upcoming')
    })
  })

  it('tapping a stamp says when and on which trip', async () => {
    await seed()
    const { fixture, host } = await render(3)

    host
      .querySelector<HTMLButtonElement>(
        '[data-testid="passport.country"][data-code="XC"] [data-testid="passport.cityStamp"] button'
      )!
      .click()
    await settle(fixture)
    const sheet = document.querySelector('[data-testid="passport.detail"]')!

    expect(sheet.querySelector('[data-testid="passport.detail.when"]')?.textContent?.trim()).toBe(
      'Stamped on 5 May 2026'
    )
    expect(sheet.querySelector('[data-testid="passport.detail.trip"]')?.textContent?.trim()).toBe(
      'On Island hop'
    )
    expect(sheet.textContent).toContain('Arrived by train')
  })

  it('reads in spanish', async () => {
    await seed()
    const { fixture, host } = await render(3)
    TestBed.inject(TranslocoService).setActiveLang('es')
    fixture.detectChanges()
    await settle(fixture)
    fixture.detectChanges()

    expect(host.textContent).toContain(SCOPE_CATALOGUES.passport.es.title)
    expect(host.querySelector('[data-testid="passport.summary"]')?.textContent).toContain(
      '2 países'
    )
  })
})
