import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { apiFakes, provideApiTesting, type ApiFakes } from '../../../testing/api-testing'
import { aiAction, aiConversation, aiConversationDetail } from '../../../testing/fake-assistant-api'
import { FakeSyncApi } from '../../../testing/fake-sync-api'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle } from '../../../testing/settle'
import { ApiFailure } from '../../core/api/api-failure'
import type { MonkiTripsDb } from '../../core/offline/db'
import { SessionStore } from '../../core/session/session.store'
import AssistantPage from './assistant.page'

describe('AssistantPage', () => {
  let db: MonkiTripsDb
  let fakes: ApiFakes
  let sync: FakeSyncApi

  function setup(online = true) {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
    db = freshOfflineDb()
    fakes = apiFakes()
    sync = new FakeSyncApi()
    TestBed.configureTestingModule({
      imports: [AssistantPage, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db, api: sync }),
        ...provideApiTesting(fakes),
        provideRouter([]),
      ],
    })
  }

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function render(conversationId?: string) {
    const fixture = TestBed.createComponent(AssistantPage)
    fixture.componentRef.setInput('tripId', 'trip-1')
    if (conversationId) {
      fixture.componentRef.setInput('conversationId', conversationId)
    }
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    const find = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    const all = (id: string) => [...host.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)]
    const composer = () => find('assistant.composer.input') as HTMLTextAreaElement
    return {
      fixture,
      host,
      find,
      all,
      composer,
      type: (text: string) => {
        composer().value = text
        composer().dispatchEvent(new Event('input'))
        fixture.detectChanges()
      },
      click: async (id: string, index = 0) => {
        all(id)[index]!.click()
        await settle(fixture)
      },
      until: (check: () => void) =>
        vi.waitFor(() => {
          fixture.detectChanges()
          check()
        }),
    }
  }

  /** A conversation with one proposal, known to the server. */
  function scriptProposal(status: 'proposed' = 'proposed') {
    fakes.assistant.conversations = [aiConversation()]
    fakes.assistant.details.set('conv-1', aiConversationDetail({ actions: [aiAction({ status })] }))
  }

  it('markup in an answer is rendered as text', async () => {
    setup()
    const page = await render()

    page.type('What is <b>bold</b>?')
    await page.click('assistant.send')
    await page.until(() => expect(fakes.assistant.streams).toHaveLength(1))
    fakes.assistant.stream.emit(
      { type: 'text', text: '<img src=x onerror="alert(1)"> and <b>this</b>\n' },
      { type: 'text', text: 'second line' }
    )
    fakes.assistant.stream.emit({
      type: 'done',
      conversationId: 'conv-new-1',
      messageId: 'msg-2',
      title: 'What is bold',
    })
    fakes.assistant.stream.end()

    await page.until(() => expect(page.all('assistant.message.text')).toHaveLength(2))
    const [question, answer] = page.all('assistant.message.text')
    expect(question.textContent?.trim()).toBe('What is <b>bold</b>?')
    expect(answer.textContent?.trim()).toBe(
      '<img src=x onerror="alert(1)"> and <b>this</b>\nsecond line'
    )
    expect(page.host.querySelector('[data-testid="assistant.log"] img')).toBeNull()
    expect(page.host.querySelector('[data-testid="assistant.log"] b')).toBeNull()
    expect(answer.hasAttribute('data-lines')).toBe(true)
    // Announced once, complete.
    await page.until(() =>
      expect(page.find('assistant.announcer')?.textContent).toContain('second line')
    )
    expect(fakes.assistant.sent).toEqual([
      { tripId: 'trip-1', conversationId: 'conv-new-1', text: 'What is <b>bold</b>?' },
    ])
  })

  it('stop keeps the partial answer', async () => {
    setup()
    const page = await render()

    page.type('What do we need tomorrow?')
    await page.click('assistant.send')
    await page.until(() => expect(page.find('assistant.thinking')).not.toBeNull())
    expect(page.find('assistant.stop')).not.toBeNull()
    fakes.assistant.stream.emit({ type: 'text', text: 'Pack the ferry ' })
    await page.until(() => expect(page.find('assistant.thinking')).toBeNull())
    await page.until(() =>
      expect(page.all('assistant.message.text')[1]?.textContent).toContain('Pack the ferry')
    )

    await page.click('assistant.stop')

    await page.until(() => expect(page.find('assistant.stopped')).not.toBeNull())
    expect(fakes.assistant.stream.aborted).toBe(true)
    expect(page.all('assistant.message.text')[1]?.textContent?.trim()).toBe('Pack the ferry')
    expect(page.find('assistant.send')).not.toBeNull()
    expect(page.find('assistant.error')).toBeNull()
    // Never announced as a finished answer; the focus is back in the composer.
    expect(page.find('assistant.announcer')?.textContent?.trim()).toBe('')
    await page.until(() => expect(document.activeElement).toBe(page.composer()))
    // The device keeps the partial answer for reading offline.
    const cached = await db.aiConversations.get('conv-new-1')
    expect(cached?.messages?.map((message) => message.content)).toEqual([
      'What do we need tomorrow?',
      'Pack the ferry ',
    ])
  })

  it('accept pulls and marks the proposal accepted', async () => {
    setup()
    scriptProposal()
    const page = await render('conv-1')
    await page.until(() => expect(page.all('assistant.proposal')).toHaveLength(1))
    const card = () => page.all('assistant.proposal')[0]!
    expect(card().textContent).toContain('฿350.00')
    expect(card().textContent).toContain('$15.56')
    expect(card().textContent).toContain('1 THB = 0.0444 AUD')
    const pullsBefore = sync.calls.filter((call) => call.kind === 'pull').length

    await page.click('assistant.proposal.accept')

    await page.until(() => expect(card().getAttribute('data-status')).toBe('accepted'))
    expect(card().querySelector('[data-testid="ui.proposal.status"]')?.textContent).toContain(
      'Accepted'
    )
    expect(page.find('assistant.proposal.accept')).toBeNull()
    expect(fakes.assistant.calls).toContain('accept:act-1')
    await page.until(() =>
      expect(sync.calls.filter((call) => call.kind === 'pull').length).toBeGreaterThan(pullsBefore)
    )
    // The status survives a reload: the device copy has it too.
    await page.until(async () =>
      expect((await db.aiConversations.get('conv-1'))?.actions?.[0]?.status).toBe('accepted')
    )
  })

  it('stale proposal explains what happened', async () => {
    setup()
    scriptProposal()
    fakes.assistant.acceptFailure = new ApiFailure({
      kind: 'http',
      status: 409,
      code: 'E_AI_ACTION_STALE',
      message: 'Stale',
    })
    const page = await render('conv-1')
    await page.until(() => expect(page.all('assistant.proposal.accept')).toHaveLength(1))

    await page.click('assistant.proposal.accept')

    await page.until(() =>
      expect(page.find('assistant.proposal.note')?.textContent).toContain(
        'The trip changed since Kiko proposed this. Ask again.'
      )
    )
    expect(page.all('assistant.proposal')[0]?.getAttribute('data-status')).toBe('failed')
    expect(page.find('assistant.proposal.accept')).toBeNull()
    expect(sync.calls.filter((call) => call.kind === 'pull')).toHaveLength(0)
  })

  it('a closed proposal takes the status the server gives, and a reload shows the stored one', async () => {
    setup()
    scriptProposal()
    fakes.assistant.acceptFailure = new ApiFailure({
      kind: 'http',
      status: 409,
      code: 'E_AI_ACTION_CLOSED',
      message: 'Closed',
      details: { status: 'expired' },
    })
    const page = await render('conv-1')
    await page.until(() => expect(page.all('assistant.proposal.accept')).toHaveLength(1))

    await page.click('assistant.proposal.accept')

    await page.until(() =>
      expect(page.all('assistant.proposal')[0]?.getAttribute('data-status')).toBe('expired')
    )
    expect(page.find('assistant.proposal.note')?.textContent).toContain('expire')

    TestBed.resetTestingModule()
    setup()
    fakes.assistant.details.set(
      'conv-1',
      aiConversationDetail({
        actions: [aiAction({ status: 'failed', errorCode: 'E_AI_ACTION_STALE' })],
      })
    )
    const reloaded = await render('conv-1')
    await reloaded.until(() =>
      expect(reloaded.all('assistant.proposal')[0]?.getAttribute('data-status')).toBe('failed')
    )
    expect(reloaded.find('assistant.proposal.note')?.textContent).toContain('The trip changed')
  })

  it('reject leaves the trip untouched', async () => {
    setup()
    scriptProposal()
    const page = await render('conv-1')
    await page.until(() => expect(page.all('assistant.proposal.reject')).toHaveLength(1))

    await page.click('assistant.proposal.reject')

    await page.until(() =>
      expect(page.all('assistant.proposal')[0]?.getAttribute('data-status')).toBe('rejected')
    )
    expect(fakes.assistant.calls).toContain('reject:act-1')
    expect(fakes.assistant.calls).not.toContain('accept:act-1')
    expect(sync.calls).toEqual([])
    expect(await db.expenses.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('quota error shows the reset date', async () => {
    setup()
    fakes.assistant.sendFailure = new ApiFailure({
      kind: 'http',
      status: 402,
      code: 'E_LLM_QUOTA_EXCEEDED',
      message: 'Over the cap',
      details: { used: 200_000, cap: 200_000, resetsOn: '2026-12-01' },
    })
    const page = await render()

    page.type('How much is left per day?')
    await page.click('assistant.send')

    await page.until(() => expect(page.find('assistant.error')).not.toBeNull())
    const error = page.find('assistant.error')!
    expect(error.getAttribute('data-code')).toBe('E_LLM_QUOTA_EXCEEDED')
    expect(error.textContent).toContain('It resets on 1 Dec.')
    // The refused message goes back to the composer; nothing stays in the log.
    expect(page.composer().value).toBe('How much is left per day?')
    expect(page.all('assistant.message')).toHaveLength(0)
  })

  it('a throttled turn says how long to wait', async () => {
    setup()
    fakes.assistant.sendFailure = new ApiFailure({
      kind: 'http',
      status: 429,
      code: 'E_TOO_MANY_REQUESTS',
      message: 'Slow down',
      retryAfterSeconds: 120,
    })
    const page = await render()

    page.type('Again')
    await page.click('assistant.send')

    await page.until(() =>
      expect(page.find('assistant.error')?.textContent).toContain('Try again in 2 min.')
    )
  })

  it('offline shows history and disables the composer', async () => {
    setup(false)
    await db.aiConversations.put({
      ...aiConversationDetail({ actions: [aiAction()] }),
    })
    const page = await render('conv-1')

    await page.until(() => expect(page.all('assistant.message.text')).toHaveLength(2))
    expect(page.all('assistant.message.text')[0]?.textContent).toContain('Log 350 baht')
    expect(page.find('assistant.offline')?.textContent).toContain('Kiko needs a connection')
    expect(page.composer().disabled).toBe(true)
    expect(page.find('assistant.send')?.hasAttribute('disabled')).toBe(true)
    expect(page.find('assistant.proposal.accept')?.hasAttribute('disabled')).toBe(true)
    expect(fakes.assistant.calls).toEqual([])
  })

  it('a new chat lists the earlier chats newest first and offers the suggestions', async () => {
    setup()
    fakes.assistant.conversations = [
      aiConversation({ id: 'c-2', title: 'Newer', updatedAt: '2026-11-07T10:00:00.000Z' }),
      aiConversation({ id: 'c-1', title: null, updatedAt: '2026-11-06T10:00:00.000Z' }),
    ]
    const page = await render()

    await page.until(() => expect(page.all('assistant.history.row')).toHaveLength(2))
    expect(page.all('assistant.history.row').map((row) => row.textContent?.trim())).toEqual([
      expect.stringContaining('Newer'),
      expect.stringContaining('Untitled chat'),
    ])
    expect(page.all('assistant.suggestion').map((button) => button.textContent?.trim())).toEqual([
      'What do we need tomorrow?',
      'How much is left per day?',
      'Log 350 baht of pad thai',
      'Move the day trip to Thursday and tell me what shifts',
    ])
  })

  it('kiko thinks until the first words and again after a proposal; the tokens left show', async () => {
    setup()
    const session = TestBed.inject(SessionStore)
    fakes.session.user = { ...fakes.session.user!, llmTokensLeft: 12_345 }
    await session.refresh()
    const page = await render()
    await page.until(() =>
      expect(page.find('assistant.tokensLeft')?.textContent).toContain('12,345 tokens left')
    )

    await page.click('assistant.suggestion', 2)
    await page.until(() => expect(page.find('assistant.thinking')).not.toBeNull())
    fakes.assistant.stream.emit({ type: 'text', text: 'Here it is.' })
    await page.until(() => expect(page.find('assistant.thinking')).toBeNull())
    fakes.assistant.stream.emit({ type: 'proposal', action: aiAction({ messageId: null }) })
    await page.until(() => expect(page.all('assistant.proposal')).toHaveLength(1))
    expect(page.find('assistant.thinking')).not.toBeNull()
    fakes.assistant.stream.emit(
      { type: 'text', text: ' Accept it to log it.' },
      { type: 'done', conversationId: 'conv-new-1', messageId: 'msg-9', title: 'Log' }
    )
    fakes.assistant.stream.end()

    await page.until(() => expect(page.find('assistant.send')).not.toBeNull())
    expect(page.find('assistant.thinking')).toBeNull()
    // The proposal sits under the answer it belongs to.
    const answer = page.all('assistant.message').at(-1)!
    expect(answer.querySelector('[data-testid="assistant.proposal"]')).not.toBeNull()
    expect(fakes.assistant.sent[0]?.text).toBe('Log 350 baht of pad thai')
  })
})
