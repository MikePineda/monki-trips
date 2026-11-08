import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { MkStampTileComponent } from './stamp-tile.component'

@Component({
  imports: [MkStampTileComponent],
  template: `
    <mk-stamp-tile
      code="XC"
      name="Harbour City"
      isoDate="2026-05-02"
      caption="Harbour City"
      meta="2 May 2026"
      label="Harbour City, stamped 2 May 2026"
      (pick)="picked = picked + 1"
    />
    <mk-stamp-tile
      code="XC"
      name="Snow Peak"
      isoDate="2027-02-02"
      [reached]="false"
      pendingLabel="Coming up"
      caption="Snow Peak"
      data-testid="probe.upcoming"
    />
  `,
})
class Host {
  picked = 0
}

describe('mk-stamp-tile', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [Host, i18nTesting()] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return { fixture, host: fixture.nativeElement as HTMLElement }
  }

  it('is a button around the stamp with the place and its date below', () => {
    const { fixture, host } = render()
    const button = host.querySelector('mk-stamp-tile button') as HTMLButtonElement

    expect(button.type).toBe('button')
    expect(button.getAttribute('aria-label')).toBe('Harbour City, stamped 2 May 2026')
    expect(button.querySelector('mk-stamp')?.getAttribute('data-state')).toBe('earned')
    expect(button.textContent).toContain('Harbour City')
    expect(button.textContent).toContain('2 May 2026')

    button.click()
    expect(fixture.componentInstance.picked).toBe(1)
  })

  it('shows an upcoming place faded, named by its caption', () => {
    const { host } = render()
    const tile = host.querySelector('[data-testid="probe.upcoming"]')!

    expect(tile.getAttribute('data-state')).toBe('upcoming')
    expect(tile.querySelector('mk-stamp')?.hasAttribute('data-reached')).toBe(false)
    expect(tile.querySelector('button')?.getAttribute('aria-label')).toBe('Snow Peak')
  })
})
