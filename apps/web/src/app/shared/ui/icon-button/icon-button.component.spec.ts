import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MkIconComponent } from '../icon/icon.component'
import { MkIconButtonComponent } from './icon-button.component'

@Component({
  imports: [MkIconButtonComponent, MkIconComponent],
  template: `
    <button mk-icon-button type="button" aria-label="Copy address" data-testid="probe.copy">
      <mk-icon name="copy" />
    </button>
    <a
      mk-icon-button
      size="sm"
      tone="accent"
      href="/trips"
      aria-label="Back"
      data-testid="probe.back"
    >
      <mk-icon name="arrow-left" />
    </a>
  `,
})
class Host {}

describe('mk-icon-button', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ imports: [Host] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('stays a native button with its accessible name and the icon as content', () => {
    const host = render()
    const button = host.querySelector<HTMLButtonElement>('[data-testid="probe.copy"]')!

    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('aria-label')).toBe('Copy address')
    expect(button.getAttribute('data-size')).toBe('md')
    expect(button.querySelector('mk-icon use')?.getAttribute('href')).toBe('sprite/lucide.svg#copy')
  })

  it('works on a link and exposes size and tone for the token styles', () => {
    const host = render()
    const link = host.querySelector<HTMLAnchorElement>('[data-testid="probe.back"]')!

    expect(link.tagName).toBe('A')
    expect(link.getAttribute('data-size')).toBe('sm')
    expect(link.getAttribute('data-tone')).toBe('accent')
  })
})
