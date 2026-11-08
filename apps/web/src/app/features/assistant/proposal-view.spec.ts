import type { AiEventChangesProposal } from '@monkitrips/shared'
import en from './i18n/en.json'
import { aiAction } from '../../../testing/fake-assistant-api'
import { proposalStatus, proposalView, type Translate } from './proposal-view'

/** The English catalogue with `{{param}}` filled, like Transloco does. */
const t: Translate = (key, params = {}) => {
  const value = key.split('.').reduce<unknown>((node, part) => (node as never)[part], en)
  if (typeof value !== 'string') {
    throw new Error(`missing ${key}`)
  }
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name]))
}

describe('proposalView', () => {
  it('an expense shows the amount, its value in the base currency and the rate of the day', () => {
    const view = proposalView(aiAction(), t, 'en-AU')

    expect(view.kind).toBe('Expense')
    expect(view.title).toBe('฿350.00 · Food')
    expect(view.summary).toBe('Pad thai')
    expect(view.changes.map((change) => [change.label, change.after])).toEqual([
      ['Amount', '฿350.00'],
      ['In AUD', '$15.56'],
      ['Rate', '1 THB = 0.0444 AUD on 7 Nov'],
      ['Category', 'Food'],
      ['Day', 'Sat 7 Nov'],
    ])
  })

  it('a move flags the night that loses its bed and the one that gains it', () => {
    const proposal: AiEventChangesProposal = {
      kind: 'event_changes',
      summary: 'Move the day trip to Thursday',
      events: [
        {
          op: 'move',
          eventId: 'e1',
          kind: 'tour',
          title: 'Day trip',
          status: 'booked',
          fields: [{ field: 'startsLocal', before: '2026-11-11T09:00', after: '2026-11-12T09:00' }],
        },
      ],
      nights: [
        { date: '2026-11-11', before: { eventId: 's1', title: 'Demo Inn' }, after: null },
        { date: '2026-11-12', before: null, after: { eventId: 's2', title: 'Demo Lodge' } },
      ],
      uncoveredBefore: 1,
      uncoveredAfter: 1,
    }

    const view = proposalView(aiAction({ tool: 'propose_event_changes', proposal }), t, 'en-AU')

    expect(view.title).toBe('Move the day trip to Thursday')
    expect(view.changes[0]).toMatchObject({
      label: 'Moved: Day trip · Starts',
      before: 'Wed 11 Nov 09:00',
      after: 'Thu 12 Nov 09:00',
      mono: true,
    })
    expect(view.changes[1]).toMatchObject({
      before: 'Demo Inn',
      after: 'No bed',
      flag: { tone: 'serious', icon: 'alert-triangle', label: 'Loses its bed' },
    })
    expect(view.changes[2]).toMatchObject({
      before: 'No bed',
      after: 'Demo Lodge',
      flag: { tone: 'good', icon: 'bed', label: 'Gains a bed' },
    })
    expect(view.changes).toHaveLength(3)
  })

  it('a task shows its due date and priority', () => {
    const view = proposalView(
      aiAction({
        tool: 'create_task',
        proposal: {
          kind: 'task',
          taskId: 't1',
          title: 'Print the ferry pass',
          dueOn: null,
          priority: 'high',
          notes: null,
          eventId: null,
        },
      }),
      t,
      'en-AU'
    )

    expect(view.changes.map((change) => change.after)).toEqual(['No due date', 'High'])
  })

  it('a decided action reads as icon plus word', () => {
    expect(proposalStatus(aiAction(), t)).toBeNull()
    expect(proposalStatus(aiAction({ status: 'failed' }), t)).toEqual({
      tone: 'serious',
      icon: 'alert-triangle',
      label: 'Not applied',
    })
  })
})
