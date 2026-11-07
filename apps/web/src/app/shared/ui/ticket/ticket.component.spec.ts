import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { MkTicketComponent } from './ticket.component'

@Component({
  imports: [MkTicketComponent],
  template: `
    <mk-ticket
      title="Train to Aldermoor"
      time="14:20"
      zone="EEST"
      countdown="in 1 h 32 min"
      leaveAt="13:40"
      [route]="['PVM', 'ALD']"
      reference="ABC123"
    >
      <button mkTicketAction type="button" data-testid="probe.directions">Directions</button>
    </mk-ticket>
    <mk-ticket title="Museum" time="10:00" [route]="['ALD', 'ALD']" data-testid="probe.second" />
  `,
})
class Host {}

describe('mk-ticket', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ imports: [Host, i18nTesting()] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('sets title, local time with its zone, the countdown and "Leave at" on the top part', () => {
    const host = render()
    const ticket = host.querySelector('mk-ticket')!

    expect(ticket.querySelector('h3')?.textContent).toBe('Train to Aldermoor')
    expect(ticket.querySelector('[data-testid="ui.ticket.time"]')?.textContent).toBe('14:20')
    expect(
      ticket
        .querySelector('[data-testid="ui.ticket.time"]')
        ?.classList.contains('mk-type-code-display')
    ).toBe(true)
    expect(ticket.querySelector('.mk-ticket__zone')?.textContent).toBe('EEST')
    expect(ticket.querySelector('.mk-ticket__countdown')?.textContent).toBe('in 1 h 32 min')
    expect(ticket.querySelector('[data-testid="ui.ticket.leave"]')?.textContent?.trim()).toBe(
      'Leave at 13:40'
    )
  })

  it('puts the route, the reference and the one action on the stub', () => {
    const host = render()
    const stub = host.querySelector('.mk-ticket__stub')!

    expect(stub.querySelector('mk-route-chip')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'PVM → ALD'
    )
    expect(stub.querySelector('mk-route-chip')?.getAttribute('data-size')).toBe('display')
    expect(stub.querySelector('[data-testid="ui.ticket.reference"]')?.textContent?.trim()).toBe(
      'ABC123'
    )
    expect(stub.querySelector('[data-testid="probe.directions"]')).not.toBeNull()
  })

  it('cuts the perforation with an SVG mask of two notches and a dashed hairline, no hex', () => {
    const host = render()
    const paper = host.querySelector('.mk-ticket__paper')!
    const mask = paper.querySelector('mask')!

    expect(paper.getAttribute('aria-hidden')).toBe('true')
    expect(mask.querySelectorAll('circle')).toHaveLength(2)
    expect([...mask.querySelectorAll('circle')].map((c) => c.getAttribute('cy'))).toEqual([
      '108',
      '108',
    ])
    expect(paper.querySelector('g')?.getAttribute('mask')).toBe(`url(#${mask.id})`)
    expect(paper.querySelector('line')?.getAttribute('stroke-dasharray')).toBe('4 4')
    expect(paper.querySelector('rect:not(mask rect)')?.getAttribute('fill')).toBe(
      'var(--surface-1)'
    )
    expect(paper.outerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('two tickets on one page keep distinct mask ids and optional parts stay out', () => {
    const host = render()
    const ids = [...host.querySelectorAll('mask')].map((mask) => mask.id)
    const second = host.querySelector('[data-testid="probe.second"]')!

    expect(new Set(ids).size).toBe(2)
    expect(second.querySelector('.mk-ticket__zone')).toBeNull()
    expect(second.querySelector('[data-testid="ui.ticket.leave"]')).toBeNull()
    expect(second.querySelector('[data-testid="ui.ticket.reference"]')).toBeNull()
  })
})
