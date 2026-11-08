import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import type { PhraseCard } from '@monkitrips/shared'
import { apiFakes, provideApiTesting, type ApiFakes } from '../../../testing/api-testing'
import { phraseCardsRow, THAI_CARDS } from '../../../testing/fake-phrase-cards-api'
import { blankStop } from '../../../testing/fake-trip-content'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle, typeInto } from '../../../testing/settle'
import { ApiFailure } from '../../core/api/api-failure'
import type { MonkiTripsDb } from '../../core/offline/db'
import { toPhraseCardRecord } from '../../core/offline/phrase-card-record'
import { formatDayDate } from '../../domain/day-date'
import { formatLocaleFor } from '../../domain/locale'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import PhrasesPage from './phrases.page'

const TRAVELLERS = [
  {
    id: 'tr-1',
    tripId: 'trip-1',
    displayName: 'Owner Demo',
    userId: 'u-1',
    position: 0,
    updatedAt: 'x',
  },
  {
    id: 'tr-2',
    tripId: 'trip-1',
    displayName: 'Partner Demo',
    userId: 'u-2',
    position: 1,
    updatedAt: 'x',
  },
]

describe('PhrasesPage', () => {
  let db: MonkiTripsDb
  let fakes: ApiFakes

  function setup(online: boolean) {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
    db = freshOfflineDb()
    fakes = apiFakes()
    TestBed.configureTestingModule({
      imports: [PhrasesPage, i18nTesting()],
      providers: [...provideOfflineTesting({ db }), ...provideApiTesting(fakes), provideRouter([])],
    })
  }

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function seed(cards: PhraseCard[] = THAI_CARDS) {
    await db.stops.put({ ...blankStop({ tripId: 'trip-1', countryCode: 'TH' }) })
    await db.travellers.bulkPut(TRAVELLERS)
    await db.phraseCards.put(toPhraseCardRecord(phraseCardsRow({ cards })))
  }

  async function render() {
    const fixture = TestBed.createComponent(PhrasesPage)
    fixture.componentRef.setInput('tripId', 'trip-1')
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    const all = (id: string) => [...host.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)]
    return {
      fixture,
      host,
      all,
      find: (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`),
      cardTexts: () =>
        all('phrases.card').map((row) => row.textContent?.replace(/\s+/g, ' ').trim()),
      click: async (id: string) => {
        host.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.click()
        await settle(fixture)
      },
      until: (check: () => void) =>
        vi.waitFor(() => {
          fixture.detectChanges()
          check()
        }),
    }
  }

  it('cards come from the device copy offline', async () => {
    setup(false)
    await seed()
    const { all, find, until } = await render()

    await until(() => expect(all('phrases.card')).toHaveLength(THAI_CARDS.length))
    expect(all('phrases.card')[0]?.textContent).toContain('สวัสดีครับ')
    expect(find('phrases.offline')).not.toBeNull()
    expect(find('phrases.generate')?.hasAttribute('disabled')).toBe(true)
    expect(fakes.phraseCards.calls).toEqual([])
  })

  it('groups the cards by category, basics first', async () => {
    setup(false)
    await seed()
    const { host, until } = await render()

    await until(() =>
      expect(
        [...host.querySelectorAll('mk-section[data-category]')].map((section) =>
          section.getAttribute('data-category')
        )
      ).toEqual(['greetings', 'reservation', 'lodging_address', 'food', 'emergency', 'numbers'])
    )
  })

  it('the destination language is preselected', async () => {
    setup(true)
    await db.stops.bulkPut([
      blankStop({ id: 's-2', tripId: 'trip-1', position: 1, countryCode: 'JP' }),
      blankStop({ id: 's-1', tripId: 'trip-1', position: 0, countryCode: 'TH' }),
    ])
    const { find, until } = await render()

    await until(() =>
      expect((find('phrases.language') as HTMLSelectElement | null)?.value).toBe('th')
    )
    expect(find('phrases.empty')?.textContent).toContain('Thai')
  })

  it('name placeholder is filled on the device only', async () => {
    setup(true)
    await seed()
    vi.spyOn(SheetService.prototype, 'confirm').mockResolvedValue(true)
    const { all, cardTexts, click, fixture, until } = await render()

    const reservation = () => cardTexts().find((text) => text?.includes('reservation')) ?? ''
    await until(() => expect(reservation()).toContain('I have a reservation under Owner Demo'))
    expect(reservation()).toContain('ผมจองไว้ในชื่อ Owner Demo')
    all('phrases.name.choice')
      .find((chip) => chip.textContent?.includes('Partner Demo'))!
      .querySelector('button')!
      .click()
    await until(() => expect(reservation()).toContain('ผมจองไว้ในชื่อ Partner Demo'))

    await click('phrases.generate')
    await until(() => expect(fakes.phraseCards.requests).toHaveLength(1))
    await settle(fixture)
    const request = JSON.stringify(fakes.phraseCards.requests)
    expect(request).not.toContain('Owner Demo')
    expect(request).not.toContain('Partner Demo')
    const stored = JSON.stringify(await db.phraseCards.toArray())
    expect(stored).toContain('{name}')
    expect(stored).not.toContain('Partner Demo')
  })

  it('markup in a card is rendered as text', async () => {
    setup(false)
    await seed([
      {
        category: 'greetings',
        prompt: '<b>Hello</b>',
        phrase: '<img src=x onerror="alert(1)">สวัสดี',
        romanization: null,
        note: null,
      },
    ])
    const { all, until } = await render()

    await until(() => expect(all('phrases.card')).toHaveLength(1))
    const row = all('phrases.card')[0]!
    expect(row.textContent).toContain('<b>Hello</b>')
    expect(row.textContent).toContain('<img src=x onerror="alert(1)">สวัสดี')
    expect(row.querySelector('b, img')).toBeNull()
  })

  it('generates with the destination language and the food preferences, showing Kiko thinking meanwhile', async () => {
    setup(true)
    await db.stops.put(blankStop({ tripId: 'trip-1', countryCode: 'TH' }))
    let open!: () => void
    fakes.phraseCards.gate = new Promise((resolve) => (open = resolve))
    const { all, find, click, host, until } = await render()

    all('phrases.food.option')
      .find((chip) => chip.dataset['option'] === 'no_peanuts')!
      .querySelector('button')!
      .click()
    typeInto(
      host.querySelector<HTMLInputElement>('[data-testid="phrases.food.note"]')!,
      'No coriander'
    )
    await click('phrases.generate')

    await until(() => expect(find('phrases.generating')).not.toBeNull())
    expect(find('phrases.generating')?.querySelector('mk-mascot')?.getAttribute('data-state')).toBe(
      'thinking'
    )
    open()
    await until(() => expect(all('phrases.card').length).toBe(THAI_CARDS.length))
    expect(fakes.phraseCards.requests).toEqual([
      {
        tripId: 'trip-1',
        language: 'th',
        preferences: ['No peanuts', 'No coriander'],
        force: false,
      },
    ])
  })

  it('regenerating asks first and replaces the set with force', async () => {
    setup(true)
    await seed()
    const confirm = vi.spyOn(SheetService.prototype, 'confirm').mockResolvedValueOnce(false)
    const { click, until } = await render()
    await until(() => expect(document.querySelector('[data-testid="phrases.card"]')).toBeDefined())

    await click('phrases.generate')
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(fakes.phraseCards.requests).toEqual([])

    confirm.mockResolvedValueOnce(true)
    fakes.phraseCards.nextSet = phraseCardsRow({ id: 'set-th-2' })
    await click('phrases.generate')
    await until(() => expect(fakes.phraseCards.calls).toEqual(['generate:th:force']))
    await vi.waitFor(async () =>
      expect((await db.phraseCards.toArray()).map((row) => row.id)).toEqual(['set-th-2'])
    )
  })

  it('quota error shows the reset date', async () => {
    setup(true)
    await db.stops.put(blankStop({ tripId: 'trip-1', countryCode: 'TH' }))
    fakes.phraseCards.failWith = new ApiFailure({
      kind: 'http',
      status: 402,
      code: 'E_LLM_QUOTA_EXCEEDED',
      message: 'Monthly AI allowance used',
      details: { used: 200_000, cap: 200_000, resetsOn: '2026-12-01' },
    })
    const { find, click, until } = await render()

    await click('phrases.generate')

    await until(() => expect(find('phrases.error')).not.toBeNull())
    const text = find('phrases.error')!.textContent ?? ''
    expect(text).toContain(formatDayDate('2026-12-01', formatLocaleFor('en'), false))
    expect(text).toContain('resets on')
    expect(find('phrases.error')!.getAttribute('data-code')).toBe('E_LLM_QUOTA_EXCEEDED')
  })

  it('a throttled request says how long to wait', async () => {
    setup(true)
    fakes.phraseCards.failWith = new ApiFailure({
      kind: 'http',
      status: 429,
      code: 'E_TOO_MANY_REQUESTS',
      message: 'Too many requests',
      retryAfterSeconds: 120,
    })
    const { find, click, until } = await render()

    await click('phrases.generate')

    await until(() => expect(find('phrases.error')?.textContent).toContain('Try again in 2 min'))
  })

  it('offers Google Translate for anything else, with the language pair', async () => {
    setup(false)
    await seed()
    const { find, until } = await render()

    await until(() => expect(find('phrases.translate')).not.toBeNull())
    const link = find('phrases.translate') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://translate.google.com/?sl=en&tl=th&op=translate')
    expect(link.getAttribute('target')).toBe('_blank')
  })
})
