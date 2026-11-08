import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { stampRotation } from './stamp-artwork'
import { MkStampComponent } from './stamp.component'
import { stampDesign } from './stamp-generator'

@Component({
  imports: [MkStampComponent],
  template: `
    <mk-stamp code="XA" name="Xaloa" date="12 May" data-testid="probe.artwork" />
    <mk-stamp
      code="ZZ"
      name="Somewhere"
      isoDate="2026-05-14"
      arrivedBy="train"
      data-testid="probe.fallback"
    />
    <mk-stamp code="XB" name="Xebria" [reached]="false" data-testid="probe.notyet" />
    <mk-stamp
      code="XC"
      name="Snow Peak"
      isoDate="2027-02-02"
      [reached]="false"
      pendingLabel="Coming up"
      data-testid="probe.upcoming"
    />
    <mk-stamp code="ZZ" name="Lantern Bay" size="sm" [animate]="true" data-testid="probe.small" />
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

  function probe(host: HTMLElement, id: string): HTMLElement {
    return host.querySelector<HTMLElement>(`[data-testid="probe.${id}"]`)!
  }

  it('paints the drawn artwork of a known place through a mask and writes name, code and date', () => {
    const stamp = probe(render(), 'artwork')

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
    expect(stamp.style.getPropertyValue('--mk-stamp-rotation')).toBe(`${stampRotation('XA')}deg`)
  })

  it('generates the stamp of a place without artwork from its name and date', () => {
    const stamp = probe(render(), 'fallback')
    const design = stampDesign({
      place: 'Somewhere',
      date: '2026-05-14',
      code: 'ZZ',
      arrivedBy: 'train',
    })

    expect(stamp.hasAttribute('data-artwork')).toBe(false)
    expect(stamp.getAttribute('data-shape')).toBe(design.shape)
    expect(stamp.getAttribute('data-icon')).toBe('train')
    expect(stamp.style.getPropertyValue('--mk-stamp-rotation')).toBe(`${design.rotation}deg`)
    expect(stamp.style.getPropertyValue('--mk-stamp-ink')).toBe(design.inkVar)
    const rings = stamp.querySelectorAll('svg .mk-stamp__ring')
    expect(rings).toHaveLength(2)
    expect(rings[0].getAttribute('d')).toBe(design.outline)
    expect(rings[0].hasAttribute('stroke-dasharray')).toBe(false)
    expect(stamp.querySelector('.mk-stamp__place')?.textContent?.trim()).toBe('SOMEWHERE')
    expect(stamp.querySelector('.mk-stamp__date')?.textContent?.trim()).toBe('14.05.2026')
    expect(stamp.querySelector('.mk-stamp__code')?.textContent?.trim()).toBe('ZZ')
    expect(stamp.querySelector('filter feTurbulence')?.getAttribute('seed')).toBe(
      String(design.texture.seed)
    )
  })

  it('stamps use only stamp tokens', () => {
    const host = render()
    for (const id of ['fallback', 'notyet', 'upcoming', 'small']) {
      expect(probe(host, id).outerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
    expect(probe(host, 'fallback').style.getPropertyValue('--mk-stamp-ink')).toMatch(
      /^var\(--stamp-ink-[1-4]\)$/
    )
  })

  it('a place not reached yet is a dashed ring that says so, even when artwork exists', () => {
    const stamp = probe(render(), 'notyet')

    expect(stamp.hasAttribute('data-reached')).toBe(false)
    expect(stamp.getAttribute('data-state')).toBe('upcoming')
    expect(stamp.hasAttribute('data-artwork')).toBe(false)
    expect(stamp.querySelector('svg .mk-stamp__ring')?.getAttribute('stroke-dasharray')).toBe('6 5')
    expect(stamp.querySelector('filter')).toBeNull()
    expect(stamp.querySelector('.mk-stamp__code')?.textContent?.trim()).toBe('Not yet')
  })

  it('an upcoming place keeps its planned date and says it is coming up', () => {
    const stamp = probe(render(), 'upcoming')

    expect(stamp.querySelector('.mk-stamp__date')?.textContent?.trim()).toBe('02.02.2027')
    expect(stamp.querySelector('.mk-stamp__code')?.textContent?.trim()).toBe('Coming up')
  })

  it('comes in three sizes and can stamp itself in once', () => {
    const host = render()
    expect(probe(host, 'small').getAttribute('data-size')).toBe('sm')
    expect(probe(host, 'small').hasAttribute('data-animate')).toBe(true)
    expect(probe(host, 'fallback').getAttribute('data-size')).toBe('md')
    expect(probe(host, 'fallback').hasAttribute('data-animate')).toBe(false)
  })

  it('gives every generated stamp its own filter and arc ids', () => {
    const host = render()
    const ids = [...host.querySelectorAll('svg [id]')].map((element) => element.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('tilts each artwork place a stable few degrees between −8 and +8', () => {
    for (const code of ['XA', 'XB', 'ZZ', 'GR-ATH']) {
      expect(stampRotation(code)).toBe(stampRotation(code))
      expect(Math.abs(stampRotation(code))).toBeLessThanOrEqual(8)
    }
    expect(stampRotation('XA')).not.toBe(stampRotation('XB'))
  })
})
