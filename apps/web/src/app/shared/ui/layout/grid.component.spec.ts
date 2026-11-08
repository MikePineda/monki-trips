import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MkGridComponent } from './grid.component'

@Component({
  imports: [MkGridComponent],
  template: `
    <mk-grid data-testid="probe.default"><span>a</span><span>b</span></mk-grid>
    <mk-grid gap="2" column="sm" data-testid="probe.small"><span>a</span></mk-grid>
  `,
})
class Host {}

describe('mk-grid', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ imports: [Host] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('lays its children out in as many equal columns as fit, by a named minimum width', () => {
    const host = render()
    const grid = host.querySelector<HTMLElement>('[data-testid="probe.default"]')!

    expect(grid.classList).toContain('mk-grid')
    expect(grid.getAttribute('data-column')).toBe('md')
    expect(grid.getAttribute('data-gap')).toBe('1')
    expect(grid.children).toHaveLength(2)
  })

  it('takes its gap from the spacing scale and its column from a named size, never pixels', () => {
    const grid = render().querySelector<HTMLElement>('[data-testid="probe.small"]')!

    expect(grid.getAttribute('data-gap')).toBe('2')
    expect(grid.getAttribute('data-column')).toBe('sm')
    expect(grid.outerHTML).not.toMatch(/style=/)
  })
})
