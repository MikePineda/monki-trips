import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../testing/i18n-testing'
import { settle } from '../../../testing/settle'
import type { SplitDraft } from '../../domain/split-draft'
import { SplitSheet, type SplitSheetData } from './split.sheet'

const DATA: SplitSheetData = {
  amountMinor: 9000,
  currency: 'AUD',
  travellers: [
    { id: 'v1', name: 'Traveller A' },
    { id: 'v2', name: 'Traveller B' },
    { id: 'v3', name: 'Traveller C' },
  ],
  draft: { payerId: 'v1', participantIds: ['v1', 'v2', 'v3'], custom: null },
}

describe('SplitSheet', () => {
  let closedWith: (SplitDraft | undefined)[]

  beforeEach(() => {
    closedWith = []
    TestBed.configureTestingModule({
      imports: [SplitSheet, i18nTesting()],
      providers: [
        { provide: DIALOG_DATA, useValue: DATA },
        { provide: DialogRef, useValue: { close: (draft?: SplitDraft) => closedWith.push(draft) } },
      ],
    })
  })

  async function render() {
    const fixture = TestBed.createComponent(SplitSheet)
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    const byId = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    const chip = (travellerId: string) =>
      host.querySelector<HTMLElement>(
        `[data-testid="money.split.participant"][data-traveller-id="${travellerId}"] button`
      )!
    const amount = (travellerId: string) =>
      host.querySelector<HTMLInputElement>(
        `[data-testid="money.split.amount"][data-traveller-id="${travellerId}"]`
      )!
    const type = async (travellerId: string, value: string) => {
      const input = amount(travellerId)
      input.value = value
      input.dispatchEvent(new Event('input'))
      await settle(fixture)
    }
    const click = async (element: HTMLElement) => {
      element.click()
      await settle(fixture)
    }
    return { fixture, byId, chip, amount, type, click }
  }

  it('an equal split between the people picked is done in one tap', async () => {
    const { chip, byId, click } = await render()

    await click(chip('v3'))
    expect(byId('money.split.sum')?.textContent).toContain('90.00')
    await click(byId('money.split.done')!)

    expect(closedWith).toEqual([{ payerId: 'v1', participantIds: ['v1', 'v2'], custom: null }])
  })

  it('custom shares must add up to the amount', async () => {
    const { byId, type, click } = await render()

    await click(byId('money.split.custom')!)
    await type('v1', '50')
    await type('v2', '20')
    await type('v3', '10')

    expect(byId('money.split.sum')?.textContent).toContain('10.00')
    expect(byId('money.split.done')?.hasAttribute('disabled')).toBe(true)

    await type('v3', '20')
    expect(byId('money.split.done')?.hasAttribute('disabled')).toBe(false)
    await click(byId('money.split.done')!)

    expect(closedWith).toEqual([
      {
        payerId: 'v1',
        participantIds: ['v1', 'v2', 'v3'],
        custom: { v1: 5000, v2: 2000, v3: 2000 },
      },
    ])
  })

  it('another payer is picked from the list of travellers', async () => {
    const { byId, fixture, click } = await render()
    const payer = byId('money.split.payer') as HTMLSelectElement

    payer.value = 'v2'
    payer.dispatchEvent(new Event('change'))
    await settle(fixture)
    await click(byId('money.split.done')!)

    expect(closedWith[0]?.payerId).toBe('v2')
  })
})
