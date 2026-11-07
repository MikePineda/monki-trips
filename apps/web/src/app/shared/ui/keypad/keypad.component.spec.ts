import { Component, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { MkKeypadComponent } from './keypad.component'

@Component({
  imports: [MkKeypadComponent],
  template: `<mk-keypad [(value)]="value" />`,
})
class Host {
  readonly value = signal('')
}

describe('mk-keypad', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [Host, i18nTesting()] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    const host = fixture.nativeElement as HTMLElement
    const tap = (key: string) => {
      host.querySelector<HTMLElement>(`[data-testid="ui.keypad.${key}"]`)!.click()
      fixture.detectChanges()
    }
    return { fixture, host, tap, value: () => fixture.componentInstance.value() }
  }

  it('has twelve mono keys: ten digits, the decimal separator and delete', () => {
    const { host } = render()
    const keys = host.querySelectorAll('button')

    expect(keys).toHaveLength(12)
    expect(keys[0].classList.contains('mk-type-code-display')).toBe(true)
    expect(host.querySelector('[data-testid="ui.keypad.delete"]')?.getAttribute('aria-label')).toBe(
      'Delete'
    )
  })

  it('types an amount with at most one separator and two decimals, and deletes', () => {
    const { tap, value } = render()

    tap('8')
    tap('4')
    tap('.')
    tap('.')
    tap('5')
    tap('0')
    tap('9')
    expect(value()).toBe('84.50')

    tap('delete')
    expect(value()).toBe('84.5')
  })

  it('a leading separator becomes 0. and a leading zero is replaced', () => {
    const { tap, value } = render()

    tap('.')
    expect(value()).toBe('0.')
    tap('delete')
    tap('delete')
    tap('0')
    tap('7')
    expect(value()).toBe('7')
  })
})
