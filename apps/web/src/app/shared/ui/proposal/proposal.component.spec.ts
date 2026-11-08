import { Component, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { MkProposalComponent, type ProposalChange, type ProposalStatus } from './proposal.component'

@Component({
  imports: [MkProposalComponent],
  template: `
    <mk-proposal
      kind="Plan change"
      icon="calendar"
      [title]="title()"
      summary="Move the day trip"
      [changes]="changes"
      [status]="status()"
    >
      <span mkProposalActions data-testid="probe.actions">actions</span>
    </mk-proposal>
  `,
})
class Host {
  readonly title = signal('<b>Day trip</b>')
  readonly status = signal<ProposalStatus | null>(null)
  readonly changes: ProposalChange[] = [
    { label: 'Starts', before: 'Wed 09:00', after: 'Thu 09:00', mono: true },
    {
      label: 'Night of Wed 3 Apr',
      before: 'Demo Inn',
      after: 'No bed',
      flag: { tone: 'serious', icon: 'alert-triangle', label: 'Loses its bed' },
    },
    { label: 'Amount', after: '฿350.00' },
  ]
}

describe('mk-proposal', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [Host, i18nTesting()] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    const host = fixture.nativeElement as HTMLElement
    return {
      fixture,
      host,
      all: (id: string) => [...host.querySelectorAll(`[data-testid="${id}"]`)],
    }
  }

  it('shows each change before and after, with the words a screen reader needs', () => {
    const { all } = render()
    const rows = all('ui.proposal.change')

    expect(rows).toHaveLength(3)
    const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ')
    expect(text(rows[0].querySelector('[data-testid="ui.proposal.before"]'))).toContain(
      'Before: Wed 09:00'
    )
    expect(text(rows[0].querySelector('[data-testid="ui.proposal.after"]'))).toContain(
      'After: Thu 09:00'
    )
    // Something new has no "before".
    expect(rows[2].querySelector('[data-testid="ui.proposal.before"]')).toBeNull()
    expect(rows[2].textContent).toContain('฿350.00')
  })

  it('flags a change with an icon and a word, not colour alone', () => {
    const { all } = render()
    const flag = all('ui.proposal.flag')[0]

    expect(flag.getAttribute('data-tone')).toBe('serious')
    expect(flag.querySelector('mk-icon')).not.toBeNull()
    expect(flag.textContent).toContain('Loses its bed')
  })

  it('renders the title as text and shows the status once decided', () => {
    const { fixture, host, all } = render()

    expect(host.querySelector('h3')?.textContent).toBe('<b>Day trip</b>')
    expect(host.querySelector('b')).toBeNull()
    expect(all('ui.proposal.status')).toHaveLength(0)

    fixture.componentInstance.status.set({ tone: 'good', icon: 'circle-check', label: 'Accepted' })
    fixture.detectChanges()

    expect(all('ui.proposal.status')[0]?.textContent).toContain('Accepted')
    expect(host.querySelector('mk-proposal')?.getAttribute('data-tone')).toBe('good')
  })
})
