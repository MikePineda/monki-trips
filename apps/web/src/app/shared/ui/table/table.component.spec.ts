import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MkTableComponent } from './table.component'

@Component({
  imports: [MkTableComponent],
  template: `<mk-table
    caption="Budget by category"
    testId="probe"
    [columns]="[
      { id: 'category', label: 'Category' },
      { id: 'spent', label: 'Spent', align: 'end' },
    ]"
    [rows]="[
      { id: 'food', cells: { category: 'Food', spent: '$5.00' } },
      { id: 'gifts', cells: { category: 'Gifts' } },
    ]"
  />`,
})
class Host {}

describe('mk-table', () => {
  it('renders a captioned table with column headers and end-aligned figures', () => {
    TestBed.configureTestingModule({ imports: [Host] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    const host = fixture.nativeElement as HTMLElement

    expect(host.querySelector('caption')?.textContent?.trim()).toBe('Budget by category')
    expect([...host.querySelectorAll('th')].map((th) => th.textContent?.trim())).toEqual([
      'Category',
      'Spent',
    ])
    const rows = host.querySelectorAll('[data-testid="probe.row"]')
    expect(rows).toHaveLength(2)
    const spent = rows[0].querySelector('[data-column="spent"]')
    expect(spent?.textContent?.trim()).toBe('$5.00')
    expect(spent?.getAttribute('data-align')).toBe('end')
    expect(rows[1].querySelector('[data-column="spent"]')?.textContent?.trim()).toBe('')
  })
})
