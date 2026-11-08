import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { MkEventRowComponent } from './event-row.component'
import { MkListRowComponent } from './list-row.component'
import { MkListComponent } from './list.component'

@Component({
  imports: [MkListComponent, MkListRowComponent, MkEventRowComponent],
  template: `
    <mk-list data-testid="probe.list">
      <mk-list-row
        title="Train tickets"
        meta="ABC123 · PDF · 2 seats"
        [monoMeta]="true"
        icon="file-text"
        [status]="{ tone: 'good', icon: 'circle-check', label: 'Saved offline' }"
        testId="probe.row.doc"
      />
      <mk-list-row
        title="Settings"
        [link]="['/t', 'trip-1', 'more', 'settings']"
        testId="probe.row.link"
      />
      <mk-list-row title="Lunch" value="€18" [chevron]="true" testId="probe.row.value" />
    </mk-list>
    <mk-list>
      <mk-list-row
        title="Sun 31 Jan"
        meta="Night 2 of 17"
        icon="train-front"
        value="On board · Train 13 Port Vellmar → Hill Town (sleeper, lower berth)"
        valueKind="text"
        [link]="['/t', 'trip-1', 'plan', 'e', 'event-1']"
        testId="probe.row.text"
      />
    </mk-list>
    <mk-list>
      <mk-event-row
        time="14:20"
        zone="EEST"
        title="Train to Aldermoor"
        meta="Coach 4 · seats 31, 32"
      >
        <a mkRowAction href="#" data-testid="probe.directions">Directions</a>
      </mk-event-row>
      <mk-event-row time="All day" title="Harbour Inn" meta="Night 1 of 2" icon="bed-double" />
    </mk-list>
  `,
})
class Host {}

describe('mk-list rows', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([])] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('the list is announced as a list of items', () => {
    const host = render()

    expect(host.querySelector('[data-testid="probe.list"]')?.getAttribute('role')).toBe('list')
    expect(host.querySelectorAll('mk-list-row[role="listitem"]')).toHaveLength(4)
  })

  it('a row shows icon, title, mono meta and a status with its icon and word in ink', () => {
    const host = render()
    const row = host.querySelector('[data-testid="probe.row.doc"]')!

    expect(row.tagName).toBe('DIV')
    expect(row.querySelector('.mk-row__title')?.textContent).toBe('Train tickets')
    expect(row.querySelector('.mk-row__meta')?.textContent).toBe('ABC123 · PDF · 2 seats')
    expect(row.querySelector('.mk-row__meta')?.hasAttribute('data-mono')).toBe(true)
    expect(row.querySelector('.mk-row__status')?.textContent?.trim()).toBe('Saved offline')
    expect(row.closest('mk-list-row')?.getAttribute('data-tone')).toBe('good')
    expect(row.querySelector('.mk-row__chevron')).toBeNull()
  })

  it('a linked row is one anchor with a chevron', () => {
    const host = render()
    const row = host.querySelector('[data-testid="probe.row.link"]')!

    expect(row.tagName).toBe('A')
    expect(row.getAttribute('href')).toBe('/t/trip-1/more/settings')
    expect(row.querySelector('.mk-row__chevron use')?.getAttribute('href')).toBe(
      'sprite/lucide.svg#chevron-right'
    )
  })

  it('a row with a value sets it in tabular body text', () => {
    const host = render()
    const row = host.querySelector('[data-testid="probe.row.value"]')!

    expect(row.querySelector('.mk-row__value')?.textContent).toBe('€18')
    expect(row.querySelector('.mk-row__value')?.classList.contains('mk-type-body')).toBe(true)
  })

  it('an event row sets the local time in mono with the zone under it and one action at the end', () => {
    const host = render()
    const rows = host.querySelectorAll('mk-event-row')

    expect(rows[0].querySelector('time')?.textContent).toBe('14:20')
    expect(rows[0].querySelector('.mk-event__time')?.classList.contains('mk-type-code')).toBe(true)
    expect(rows[0].querySelector('.mk-event__zone')?.textContent).toBe('EEST')
    expect(
      rows[0].querySelector('.mk-event__action [data-testid="probe.directions"]')
    ).not.toBeNull()
    expect(rows[1].querySelector('.mk-event__zone')).toBeNull()
    expect(rows[1].querySelector('mk-icon use')?.getAttribute('href')).toBe(
      'sprite/lucide.svg#bed-double'
    )
    expect(rows[1].querySelector('.mk-event__meta')?.textContent).toBe('Night 1 of 2')
  })

  it('a figure value never shrinks: the title gives way and ellipsizes', () => {
    const host = render()
    const row = host.querySelector('[data-testid="probe.row.value"]')!

    expect(getComputedStyle(row.querySelector('.mk-row__value')!).flexShrink).toBe('0')
    expect(getComputedStyle(row.querySelector('.mk-row__text')!).minWidth).toBe('0px')
    expect(getComputedStyle(row.closest('mk-list-row')!).minWidth).toBe('0px')
  })

  it('a text value gives way to a whole date and meta, wraps to two lines and keeps the chevron', () => {
    const host = render()
    const listRow = host.querySelector('mk-list-row:has([data-testid="probe.row.text"])')!
    const row = host.querySelector('[data-testid="probe.row.text"]')!
    const lead = getComputedStyle(row.querySelector('.mk-row__text')!)
    const title = getComputedStyle(row.querySelector('.mk-row__title')!)
    const meta = getComputedStyle(row.querySelector('.mk-row__meta')!)
    const value = getComputedStyle(row.querySelector('.mk-row__value')!)

    expect(listRow.getAttribute('data-value-kind')).toBe('text')
    expect(lead.flexShrink).toBe('0')
    expect(title.textOverflow).not.toBe('ellipsis')
    expect(meta.whiteSpace).toBe('nowrap')
    expect(value.whiteSpace).toBe('normal')
    expect(value.minWidth).toBe('0px')
    expect(value.flexGrow).toBe('1')
    // At most two lines (line-clamp, measured in J05c), then the rest is hidden.
    expect(value.overflow).toBe('hidden')
    expect(row.querySelector('.mk-row__chevron')).not.toBeNull()
  })
})
