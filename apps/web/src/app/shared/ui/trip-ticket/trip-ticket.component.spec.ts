import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { provideRouter, RouterLink } from '@angular/router'
import { MkTripTicketComponent } from './trip-ticket.component'

@Component({
  imports: [MkTripTicketComponent, RouterLink],
  template: `
    <a
      mk-trip-ticket
      [routerLink]="['/t', 'trip-1', 'today']"
      title="Island hop"
      eyebrow="Back 5 days ago"
      [route]="['Harbour City', 'Old Town']"
      stats="10 days · 9 nights · 2 countries"
      dates="1 – 10 May 2026"
      amount="€150.50"
    >
      <span mkTicketStamp data-testid="probe.stamp">stamp</span>
    </a>
  `,
})
class Host {}

describe('mk-trip-ticket', () => {
  it('is the link of a trip with its route, numbers, dates, spend and cover stamp', () => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([])] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    const ticket = (fixture.nativeElement as HTMLElement).querySelector('a')!
    const text = ticket.textContent!.replace(/\s+/g, ' ')

    expect(ticket.getAttribute('href')).toBe('/t/trip-1/today')
    expect(ticket.classList).toContain('mk-trip-ticket')
    expect(text).toContain('Back 5 days ago')
    expect(text).toContain('Island hop')
    expect(text).toContain('Harbour City → Old Town')
    expect(text).toContain('10 days · 9 nights · 2 countries')
    expect(text).toContain('1 – 10 May 2026')
    expect(ticket.querySelector('[data-testid="mk-trip-ticket.amount"]')?.textContent?.trim()).toBe(
      '€150.50'
    )
    expect(ticket.querySelector('.mk-trip-ticket__stub [data-testid="probe.stamp"]')).not.toBeNull()
  })
})
