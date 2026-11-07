import { Dialog } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { SheetService } from './sheet.service'

describe('SheetService.confirm', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [i18nTesting()] })
    return TestBed.inject(SheetService)
  }

  afterEach(() => {
    TestBed.inject(Dialog).closeAll()
  })

  async function opened() {
    await new Promise((resolve) => setTimeout(resolve, 0))
    TestBed.tick()
    return document.querySelector<HTMLElement>('.cdk-overlay-container [role="dialog"]')
  }

  it('shows the copy it was given and resolves true when the action is pressed', async () => {
    const sheets = setup()

    const answer = sheets.confirm({
      title: 'Leave the trip?',
      body: 'You will need a new invitation to come back.',
      confirmLabel: 'Leave',
      destructive: true,
    })
    const dialog = await opened()

    expect(dialog?.querySelector('h2')?.textContent).toBe('Leave the trip?')
    expect(dialog?.querySelector('[data-testid="ui.confirm.body"]')?.textContent).toBe(
      'You will need a new invitation to come back.'
    )
    const confirm = dialog?.querySelector<HTMLButtonElement>('[data-testid="ui.confirm.confirm"]')
    expect(confirm?.textContent?.trim()).toBe('Leave')
    expect(confirm?.getAttribute('data-variant')).toBe('destructive')
    expect(dialog?.querySelector('[data-testid="ui.confirm.cancel"]')?.textContent?.trim()).toBe(
      'Cancel'
    )
    confirm!.click()

    expect(await answer).toBe(true)
  })

  it('resolves false on cancel', async () => {
    const sheets = setup()

    const answer = sheets.confirm({ title: 'Remove?', body: 'Gone.', confirmLabel: 'Remove' })
    const dialog = await opened()
    dialog?.querySelector<HTMLButtonElement>('[data-testid="ui.confirm.cancel"]')!.click()

    expect(await answer).toBe(false)
  })

  it('resolves false when the sheet is dismissed without an answer', async () => {
    const sheets = setup()

    const answer = sheets.confirm({ title: 'Remove?', body: 'Gone.', confirmLabel: 'Remove' })
    await opened()
    TestBed.inject(Dialog).closeAll()

    expect(await answer).toBe(false)
  })
})
