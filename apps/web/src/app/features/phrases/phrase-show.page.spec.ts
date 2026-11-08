import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { provideApiTesting } from '../../../testing/api-testing'
import { phraseCardsRow, THAI_CARDS } from '../../../testing/fake-phrase-cards-api'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle } from '../../../testing/settle'
import type { MonkiTripsDb } from '../../core/offline/db'
import { toPhraseCardRecord } from '../../core/offline/phrase-card-record'
import { META_PHRASE_NAMES } from './phrase-name.store'
import PhraseShowPage from './phrase-show.page'

describe('PhraseShowPage', () => {
  let db: MonkiTripsDb
  let wakeLock: { request: ReturnType<typeof vi.fn> }
  let released: number

  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    released = 0
    wakeLock = {
      request: vi.fn(async () => ({
        released: false,
        release: async () => {
          released += 1
        },
      })),
    }
    Object.defineProperty(navigator, 'wakeLock', { value: wakeLock, configurable: true })
    db = freshOfflineDb()
    TestBed.configureTestingModule({
      imports: [PhraseShowPage, i18nTesting()],
      providers: [...provideOfflineTesting({ db }), ...provideApiTesting(), provideRouter([])],
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(navigator, 'wakeLock')
    await resetOfflineTesting(db)
  })

  async function render(cardKey: string) {
    const fixture = TestBed.createComponent(PhraseShowPage)
    fixture.componentRef.setInput('tripId', 'trip-1')
    fixture.componentRef.setInput('cardKey', cardKey)
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    return {
      fixture,
      find: (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`),
      until: (check: () => void) =>
        vi.waitFor(() => {
          fixture.detectChanges()
          check()
        }),
    }
  }

  it('shows the card full screen from the device copy, with the picked name filled in', async () => {
    await db.phraseCards.put(toPhraseCardRecord(phraseCardsRow()))
    await db.meta.put({ key: META_PHRASE_NAMES, value: { 'trip-1': 'Partner Demo' } })
    const { find, until } = await render('set-th:1')

    await until(() =>
      expect(find('ui.showCard.phrase')?.textContent?.trim()).toBe('ผมจองไว้ในชื่อ Partner Demo')
    )
    expect(find('ui.showCard.phrase')?.getAttribute('lang')).toBe('th')
    expect(find('ui.showCard.romanization')?.textContent?.trim()).toBe(
      'phom jong wai nai chue Partner Demo'
    )
    expect(find('ui.showCard.prompt')?.textContent?.trim()).toBe(
      'I have a reservation under Partner Demo'
    )
    expect(THAI_CARDS[1]?.phrase).toContain('{name}')
  })

  it('keeps the screen awake while the card is open and lets it sleep when it closes', async () => {
    await db.phraseCards.put(toPhraseCardRecord(phraseCardsRow()))
    const { fixture, find, until } = await render('set-th:0')

    await until(() => expect(find('ui.showCard.keptOn')).not.toBeNull())
    expect(wakeLock.request).toHaveBeenCalledWith('screen')

    fixture.destroy()
    await vi.waitFor(() => expect(released).toBe(1))
  })

  it('markup in a card is rendered as text in show mode too', async () => {
    await db.phraseCards.put(
      toPhraseCardRecord(
        phraseCardsRow({
          cards: [
            {
              category: 'greetings',
              prompt: 'Hello <script>x()</script>',
              phrase: '<b>สวัสดี</b>',
              romanization: null,
              note: '<i>note</i>',
            },
          ],
        })
      )
    )
    const { find, until } = await render('set-th:0')

    await until(() => expect(find('ui.showCard.phrase')?.textContent?.trim()).toBe('<b>สวัสดี</b>'))
    expect(find('phrases.show')?.querySelector('b, i, script')).toBeNull()
    expect(find('phrases.show')?.textContent).toContain('<i>note</i>')
  })

  it('says the card is gone when the key no longer points at one', async () => {
    await db.phraseCards.put(toPhraseCardRecord(phraseCardsRow()))
    const { find, until } = await render('old-set:0')

    await until(() => expect(find('phrases.show.missing')).not.toBeNull())
    expect(find('phrases.show')).toBeNull()
  })
})
