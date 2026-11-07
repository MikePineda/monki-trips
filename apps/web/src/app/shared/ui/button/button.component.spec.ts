import { Component, input } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { MkButtonComponent, type ButtonSize, type ButtonVariant } from './button.component'

@Component({
  imports: [MkButtonComponent],
  template: `
    <button
      mk-button
      [variant]="variant()"
      [size]="size()"
      [loading]="loading()"
      [disabled]="disabled()"
    >
      Save
    </button>
  `,
})
class Host {
  readonly variant = input<ButtonVariant>('primary')
  readonly size = input<ButtonSize>('md')
  readonly loading = input(false)
  readonly disabled = input(false)
}

describe('mk-button', () => {
  function render(
    inputs: Partial<{
      variant: ButtonVariant
      size: ButtonSize
      loading: boolean
      disabled: boolean
    }>
  ) {
    TestBed.configureTestingModule({ imports: [Host, i18nTesting()] })
    const fixture = TestBed.createComponent(Host)
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value)
    }
    fixture.detectChanges()
    return fixture.nativeElement.querySelector('button') as HTMLButtonElement
  }

  it('stays a native button with its label, primary and 44 px by default', () => {
    const button = render({})

    expect(button.textContent?.trim()).toBe('Save')
    expect(button.disabled).toBe(false)
    expect(button.getAttribute('data-variant')).toBe('primary')
    expect(button.getAttribute('data-size')).toBe('md')
    expect(button.classList.contains('mk-type-body-strong')).toBe(true)
  })

  it.each<ButtonVariant>(['primary', 'secondary', 'ghost', 'destructive'])(
    'renders the %s variant',
    (variant) => {
      const button = render({ variant })

      expect(button.getAttribute('data-variant')).toBe(variant)
    }
  )

  it.each<ButtonSize>(['md', 'sm', 'block'])('renders the %s size', (size) => {
    const button = render({ size })

    expect(button.getAttribute('data-size')).toBe(size)
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
