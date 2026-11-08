import { DIALOG_DATA, Dialog } from '@angular/cdk/dialog'
import { Component, inject } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { MkSheetComponent } from './sheet.component'
import { SheetService } from './sheet.service'

@Component({
  imports: [MkSheetComponent],
  template: `
    <mk-sheet title="Pick a category">
      <p data-testid="probe.data">{{ data.label }}</p>
      <button type="button" data-testid="probe.first">First</button>
    </mk-sheet>
  `,
})
class ProbeSheet {
  protected readonly data = inject<{ label: string }>(DIALOG_DATA)
}

describe('mk-sheet', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [i18nTesting()] })
    return { sheets: TestBed.inject(SheetService), dialog: TestBed.inject(Dialog) }
  }

  afterEach(() => {
    TestBed.inject(Dialog).closeAll()
  })

  /** Escape as the CDK reads it (keyCode, like a real browser event). */
  function escape(): KeyboardEvent {
    return new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true })
  }

  function dialogElement(): HTMLElement | null {
    return document.querySelector('.cdk-overlay-container [role="dialog"]')
  }

  it('opens the component as a modal bottom sheet with its data and a backdrop', () => {
    const { sheets } = setup()

    sheets.open(ProbeSheet, { data: { label: 'Food' }, label: 'Pick a category' })
    TestBed.tick()

    const dialog = dialogElement()
    expect(dialog).not.toBeNull()
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.getAttribute('aria-label')).toBe('Pick a category')
    expect(dialog?.querySelector('[data-testid="probe.data"]')?.textContent).toBe('Food')
    expect(dialog?.querySelector('h2')?.textContent).toBe('Pick a category')
    expect(document.querySelector('.cdk-overlay-container .mk-sheet-backdrop')).not.toBeNull()
    expect(document.querySelector('.cdk-overlay-container .mk-sheet-panel')).not.toBeNull()
  })

  it('a sheet opened without a label is named by its own title', () => {
    const { sheets } = setup()

    sheets.open(ProbeSheet, { data: { label: 'Food' } })
    TestBed.tick()

    const dialog = dialogElement()!
    const title = dialog.querySelector('h2')!
    expect(title.id).not.toBe('')
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id)
  })

  it('traps focus inside the sheet while it is open', async () => {
    const { sheets } = setup()

    sheets.open(ProbeSheet, { data: { label: 'Food' } })
    TestBed.tick()
    await Promise.resolve()

    const dialog = dialogElement()
    expect(dialog?.parentElement?.querySelectorAll('.cdk-focus-trap-anchor')).toHaveLength(2)
    expect(dialog?.contains(document.activeElement)).toBe(true)
  })

  it('Escape closes it and the result reaches the opener', async () => {
    const { sheets, dialog } = setup()
    const ref = sheets.open<string>(ProbeSheet, { data: { label: 'Food' } })
    let result: string | undefined = 'untouched'
    ref.closed.subscribe((value) => (result = value))

    document.body.dispatchEvent(escape())

    expect(result).toBeUndefined()
    expect(dialog.openDialogs).toHaveLength(0)
    expect(dialogElement()).toBeNull()
  })

  it('the close button in the frame closes it too', () => {
    const { sheets, dialog } = setup()
    sheets.open(ProbeSheet, { data: { label: 'Food' } })
    TestBed.tick()
    const close = dialogElement()?.querySelector(
      '[data-testid="ui.sheet.close"]'
    ) as HTMLButtonElement

    expect(close.getAttribute('aria-label')).toBe('Close')
    close.click()

    expect(dialog.openDialogs).toHaveLength(0)
  })

  it('disableClose keeps the sheet open on Escape', () => {
    const { sheets, dialog } = setup()
    sheets.open(ProbeSheet, { data: { label: 'Food' }, disableClose: true })

    document.body.dispatchEvent(escape())

    expect(dialog.openDialogs).toHaveLength(1)
  })
})
