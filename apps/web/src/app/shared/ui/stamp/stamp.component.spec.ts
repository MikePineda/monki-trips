import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { stampRotation } from './stamp-artwork'
import { MkStampComponent } from './stamp.component'

@Component({
  imports: [MkStampComponent],
  template: `
    <mk-stamp code="XA" name="Xaloa" date="12 May" data-testid="probe.artwork" />
    <mk-stamp code="ZZ" name="Somewhere" date="14 May" data-testid="probe.fallback" />
    <mk-stamp code="XB" name="Xebria" [reached]="false" data-testid="probe.notyet" />
  `,
})
class Host {}

describe('mk-stamp', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ imports: [Host, i18nTesting()] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('paints the drawn artwork of a known place through a mask and writes name, code and date', () => {
    const host = render()
    const stamp = host.querySelector<HTMLElement>('[data-testid="probe.artwork"]')!

    expect(stamp.getAttribute('role')).toBe('img')
    expect(stamp.getAttribute('aria-label')).toBe('Xaloa')
    expect(stamp.getAttribute('data-artwork')).toBe('XA')
    expect(stamp.style.getPropertyValue('--mk-stamp-artwork')).toBe('url(stamps/XA.svg)')
    expect(stamp.querySelector('.mk-stamp__artwork')).not.toBeNull()
    expect(stamp.querySelector('svg')).toBeNull()
    expect(stamp.querySelector('.mk-stamp__name')?.textContent).toBe('Xaloa')
    expect(stamp.querySelector('.mk-stamp__meta')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'XA · 12 May'
    )
  })

  it('generates two rings inline for a place without artwork', () => {
    const host = render()
    const stamp = host.querySelector<HTMLElement>('[data-testid="probe.fallback"]')!

    expect(stamp.hasAttribute('data-artwork')).toBe(false)
    expect(stamp.querySelectorAll('svg circle')).toHaveLength(2)
    expect(stamp.querySelector('svg circle')?.hasAttribute('stroke-dasharray')).toBe(false)
    expect(stamp.outerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('a place not reached yet is a dashed ring that says so, even when artwork exists', () => {
    const host = render()
    const stamp = host.querySelector<HTMLElement>('[data-testid="probe.notyet"]')!

    expect(stamp.hasAttribute('data-reached')).toBe(false)
    expect(stamp.hasAttribute('data-artwork')).toBe(false)
    expect(stamp.querySelector('svg circle')?.getAttribute('stroke-dasharray')).toBe('6 5')
    expect(stamp.querySelector('.mk-stamp__meta')?.textContent?.trim()).toBe('Not yet')
  })

  it('tilts each place a stable few degrees between −8 and +8', () => {
    const host = render()
    const stamp = host.querySelector<HTMLElement>('[data-testid="probe.artwork"]')!

    expect(stamp.style.getPropertyValue('--mk-stamp-rotation')).toBe(`${stampRotation('XA')}deg`)
    for (const code of ['XA', 'XB', 'ZZ', 'GR-ATH']) {
      expect(stampRotation(code)).toBe(stampRotation(code))
      expect(Math.abs(stampRotation(code))).toBeLessThanOrEqual(8)
    }
    expect(stampRotation('XA')).not.toBe(stampRotation('XB'))
  })
})
