import { TestBed } from '@angular/core/testing'
import { MkIconComponent } from './icon.component'

describe('mk-icon', () => {
  function render(inputs: { name: string; size?: number; label?: string }) {
    TestBed.configureTestingModule({ imports: [MkIconComponent] })
    const fixture = TestBed.createComponent(MkIconComponent)
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value)
    }
    fixture.detectChanges()
    return fixture.nativeElement.querySelector('svg') as SVGElement
  }

  it('references the named symbol of the generated sprite', () => {
    const svg = render({ name: 'map-pin' })

    expect(svg.querySelector('use')?.getAttribute('href')).toBe('sprite/lucide.svg#map-pin')
  })

  it('is 20 px and decorative by default', () => {
    const svg = render({ name: 'plus' })

    expect(svg.getAttribute('width')).toBe('20')
    expect(svg.getAttribute('height')).toBe('20')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('role')).toBeNull()
  })

  it('a label turns it into an announced image', () => {
    const svg = render({ name: 'wifi-off', label: 'Offline', size: 16 })

    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Offline')
    expect(svg.getAttribute('aria-hidden')).toBeNull()
    expect(svg.getAttribute('width')).toBe('16')
  })
})
