import { Component, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MkBarChartComponent, type ChartBar } from './bar-chart.component'

@Component({
  imports: [MkBarChartComponent],
  template: `<mk-bar-chart [bars]="bars()" testId="probe" />`,
})
class Host {
  readonly bars = signal<ChartBar[]>([
    {
      id: 'food',
      label: 'Food',
      value: 50,
      target: 200,
      valueText: '$0.50',
      targetText: 'of $2.00',
    },
    {
      id: 'transport',
      label: 'Transport',
      value: 120,
      target: 100,
      valueText: '$1.20',
      targetText: 'of $1.00',
      status: { tone: 'serious', icon: 'alert-triangle', label: 'Over budget' },
    },
    {
      id: 'gifts',
      label: 'Gifts',
      value: 40,
      target: null,
      valueText: '$0.40',
      targetText: 'No budget',
    },
  ])
}

describe('mk-bar-chart', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [Host] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('draws every bar on one axis scaled to the largest value or target', () => {
    const host = render()
    const bars = [...host.querySelectorAll<HTMLElement>('[data-testid="probe.bar"]')]
    const width = (bar: HTMLElement, part: string) =>
      bar.querySelector<HTMLElement>(`.mk-bar__${part}`)?.style.width ?? null

    expect(bars).toHaveLength(3)
    expect(width(bars[0], 'track')).toBe('100%')
    expect(width(bars[0], 'fill')).toBe('25%')
    expect(width(bars[1], 'fill')).toBe('60%')
    // A bar without a target is honest: no track to fill.
    expect(bars[2].querySelector('.mk-bar__track')).toBeNull()
  })

  it('writes the figures and says a bad state with an icon and a word', () => {
    const host = render()
    const bars = [...host.querySelectorAll<HTMLElement>('[data-testid="probe.bar"]')]

    expect(bars[0].textContent).toContain('$0.50')
    expect(bars[2].textContent).toContain('No budget')
    expect(bars[1].getAttribute('data-tone')).toBe('serious')
    expect(bars[1].querySelector('.mk-bar__status mk-icon')).not.toBeNull()
    expect(bars[1].textContent).toContain('Over budget')
  })

  it('on a narrow screen the figures move under the label, right-aligned and whole', () => {
    const host = render()
    const head = host.querySelector('.mk-bar__head')!
    const figures = host.querySelector('.mk-bar__figures')!

    expect(getComputedStyle(head).flexWrap).toBe('wrap')
    expect(getComputedStyle(figures).marginLeft).toBe('auto')
    expect(getComputedStyle(figures).whiteSpace).toBe('nowrap')
    expect(getComputedStyle(figures).textAlign).toBe('end')
  })
})
