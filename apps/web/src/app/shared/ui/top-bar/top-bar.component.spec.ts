import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { MkTopBarComponent } from './top-bar.component'

@Component({
  imports: [MkTopBarComponent],
  template: `
    <mk-top-bar title="Sample trip" backLink="/trips" backLabel="Back to trips">
      <span mkTopBarStatus data-testid="probe.status">Offline · everything saved</span>
      <button mkTopBarActions type="button" data-testid="probe.action">Settings</button>
    </mk-top-bar>
    <mk-top-bar title="monki trips" data-testid="probe.plain" />
  `,
})
class Host {}

describe('mk-top-bar', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([])] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('shows the back link, the title, the status line and the actions', () => {
    const host = render()
    const bar = host.querySelector('mk-top-bar')!

    expect(bar.querySelector('[data-testid="shell.back"]')?.getAttribute('href')).toBe('/trips')
    expect(bar.querySelector('[data-testid="shell.back"]')?.getAttribute('aria-label')).toBe(
      'Back to trips'
    )
    expect(bar.querySelector('[data-testid="shell.name"]')?.textContent).toBe('Sample trip')
    expect(bar.querySelector('.mk-top-bar__text [data-testid="probe.status"]')).not.toBeNull()
    expect(bar.querySelector('.mk-top-bar__actions [data-testid="probe.action"]')).not.toBeNull()
  })

  it('without a back link there is no back control', () => {
    const host = render()

    expect(host.querySelector('[data-testid="probe.plain"] [data-testid="shell.back"]')).toBeNull()
  })
})
