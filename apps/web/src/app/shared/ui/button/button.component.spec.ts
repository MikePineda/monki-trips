import { Component, input } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { MkButtonComponent, type ButtonVariant } from './button.component'

@Component({
  imports: [MkButtonComponent],
  template: `
    <button mk-button [variant]="variant()" [loading]="loading()" [disabled]="disabled()">
      Save
    </button>
  `,
})
class Host {
  readonly variant = input<ButtonVariant>('primary')
  readonly loading = input(false)
  readonly disabled = input(false)
}

describe('mk-button', () => {
  function render(
    inputs: Partial<{ variant: ButtonVariant; loading: boolean; disabled: boolean }>
  ) {
    TestBed.configureTestingModule({ imports: [Host, i18nTesting()] })
    const fixture = TestBed.createComponent(Host)
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value)
    }
    fixture.detectChanges()
    return fixture.nativeElement.querySelector('button') as HTMLButtonElement
  }

  it('stays a native button with its label', () => {
    const button = render({})

    expect(button.textContent?.trim()).toBe('Save')
    expect(button.disabled).toBe(false)
    expect(button.classList.contains('mk-button--primary')).toBe(true)
  })

  it.each<ButtonVariant>(['primary', 'secondary', 'ghost'])('renders the %s variant', (variant) => {
    const button = render({ variant })

    expect(button.classList.contains(`mk-button--${variant}`)).toBe(true)
  })

  it('loading disables the button, announces busy and shows a spinner', () => {
    const button = render({ loading: true })

    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.querySelector('mk-icon svg')?.getAttribute('aria-label')).toBe('Loading')
    expect(button.textContent).toContain('Save')
  })

  it('disabled sets the native attribute and aria-disabled', () => {
    const button = render({ disabled: true })

    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.getAttribute('aria-busy')).toBeNull()
  })
})
