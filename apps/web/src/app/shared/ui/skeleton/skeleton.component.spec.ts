import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { MkSkeletonComponent } from './skeleton.component'

describe('mk-skeleton', () => {
  function render(rows?: number) {
    TestBed.configureTestingModule({ imports: [MkSkeletonComponent, i18nTesting()] })
    const fixture = TestBed.createComponent(MkSkeletonComponent)
    if (rows !== undefined) {
      fixture.componentRef.setInput('rows', rows)
    }
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('renders three hairline rows by default and announces loading once', () => {
    const host = render()

    expect(host.querySelectorAll('.mk-skeleton__row')).toHaveLength(3)
    expect(host.getAttribute('role')).toBe('status')
    expect(host.getAttribute('aria-busy')).toBe('true')
    expect(host.textContent).toContain('Loading…')
  })

  it('renders as many rows as asked', () => {
    expect(render(5).querySelectorAll('.mk-skeleton__row')).toHaveLength(5)
  })

  it('shows no mascot unless asked, and a small one when a screen waits', () => {
    expect(render().querySelector('mk-mascot')).toBeNull()

    TestBed.resetTestingModule()
    TestBed.configureTestingModule({ imports: [MkSkeletonComponent, i18nTesting()] })
    const fixture = TestBed.createComponent(MkSkeletonComponent)
    fixture.componentRef.setInput('mascot', 'thinking')
    fixture.detectChanges()
    const mascot = (fixture.nativeElement as HTMLElement).querySelector('mk-mascot')

    expect(mascot?.getAttribute('data-state')).toBe('thinking')
    expect(mascot?.getAttribute('data-size')).toBe('sm')
    expect(mascot?.getAttribute('aria-hidden')).toBe('true')
  })
})
