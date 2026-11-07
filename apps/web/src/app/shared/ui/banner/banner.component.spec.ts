import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MkBannerComponent } from './banner.component'

@Component({
  imports: [MkBannerComponent],
  template: `
    <mk-banner
      tone="print"
      icon="printer"
      title="Bring this printed"
      body="Museum voucher · 2 pages"
    >
      <button mkBannerAction type="button" data-testid="probe.printed">I printed it</button>
    </mk-banner>
    <mk-banner
      tone="critical"
      role="alert"
      icon="circle-x"
      title="Sync failed"
      data-testid="probe.critical"
    />
  `,
})
class Host {}

describe('mk-banner', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ imports: [Host] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('the print banner shows the printer, the bold line, the document and the one action', () => {
    const host = render()
    const banner = host.querySelector('mk-banner')!

    expect(banner.getAttribute('data-tone')).toBe('print')
    expect(banner.getAttribute('role')).toBe('status')
    expect(banner.querySelector('mk-icon use')?.getAttribute('href')).toBe(
      'sprite/lucide.svg#printer'
    )
    expect(banner.querySelector('.mk-banner__title')?.textContent).toBe('Bring this printed')
    expect(banner.querySelector('.mk-banner__body')?.textContent).toBe('Museum voucher · 2 pages')
    expect(banner.querySelector('[data-testid="probe.printed"]')).not.toBeNull()
  })

  it('a critical banner is an alert with no caption line', () => {
    const host = render()
    const banner = host.querySelector('[data-testid="probe.critical"]')!

    expect(banner.getAttribute('role')).toBe('alert')
    expect(banner.getAttribute('data-tone')).toBe('critical')
    expect(banner.querySelector('.mk-banner__body')).toBeNull()
  })
})
