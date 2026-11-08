import { Component, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { settle } from '../../../../testing/settle'
import { MkShowCardComponent } from './show-card.component'

@Component({
  imports: [MkShowCardComponent],
  template: `
    <mk-show-card
      lang="th"
      [phrase]="phrase()"
      romanization="sawatdee"
      prompt="Hello"
      note="Say it with a smile."
      [screenKeptOn]="true"
      (closed)="closes = closes + 1"
    />
  `,
})
class Host {
  readonly phrase = signal('สวัสดี')
  closes = 0
}

describe('mk-show-card', () => {
  async function render() {
    TestBed.configureTestingModule({ imports: [Host, i18nTesting()] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    return {
      fixture,
      host,
      find: (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`),
    }
  }

  it('shows the phrase in its language, the romanization and the traveller’s wording as a modal dialog', async () => {
    const { host, find } = await render()
    const card = host.querySelector('mk-show-card')!

    expect(card.getAttribute('role')).toBe('dialog')
    expect(card.getAttribute('aria-modal')).toBe('true')
    expect(card.getAttribute('aria-label')).toBe('Hello')
    expect(find('ui.showCard.phrase')?.textContent?.trim()).toBe('สวัสดี')
    expect(find('ui.showCard.phrase')?.getAttribute('lang')).toBe('th')
    expect(find('ui.showCard.romanization')?.textContent?.trim()).toBe('sawatdee')
    expect(find('ui.showCard.prompt')?.textContent?.trim()).toBe('Hello')
    expect(find('ui.showCard.keptOn')).not.toBeNull()
  })

  it('renders markup in the phrase as text', async () => {
    const { fixture, find } = await render()
    fixture.componentInstance.phrase.set('<img src=x onerror="alert(1)"><b>bold</b>')
    fixture.detectChanges()

    expect(find('ui.showCard.phrase')?.textContent?.trim()).toBe(
      '<img src=x onerror="alert(1)"><b>bold</b>'
    )
    expect(find('ui.showCard.phrase')?.querySelector('img, b')).toBeNull()
  })

  it('closes with the button and with Escape', async () => {
    const { fixture, host, find } = await render()

    find('ui.showCard.close')!.click()
    host
      .querySelector('mk-show-card')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(fixture.componentInstance.closes).toBe(2)
  })
})
