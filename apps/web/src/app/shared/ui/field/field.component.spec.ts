import { Component, input } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { TranslocoService } from '@jsverse/transloco'
import { i18nTesting } from '../../../../testing/i18n-testing'
import type { FieldError } from '../../../core/i18n/form-messages'
import { MkFieldComponent } from './field.component'

@Component({
  imports: [MkFieldComponent],
  template: `
    <mk-field
      label="Trip name"
      hint="Something you will recognise"
      [required]="true"
      [error]="error()"
    >
      <input type="text" data-testid="probe.input" />
    </mk-field>
  `,
})
class Host {
  readonly error = input<FieldError | null>(null)
}

describe('mk-field', () => {
  function render(error: FieldError | null = null) {
    TestBed.configureTestingModule({ imports: [Host, i18nTesting()] })
    const fixture = TestBed.createComponent(Host)
    fixture.componentRef.setInput('error', error)
    fixture.detectChanges()
    return fixture
  }

  it('labels the projected control and shows the hint while valid', () => {
    const host = render().nativeElement as HTMLElement
    const label = host.querySelector('label')

    expect(label?.querySelector('[data-testid="probe.input"]')).not.toBeNull()
    expect(label?.textContent).toContain('Trip name')
    expect(host.querySelector('.mk-field__hint')?.textContent).toBe('Something you will recognise')
    expect(host.querySelector('[role="alert"]')).toBeNull()
  })

  it('shows the translated error with its parameters instead of the hint', () => {
    const host = render({ kind: 'minLength', minLength: 3 }).nativeElement as HTMLElement

    expect(host.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Use at least 3 characters'
    )
    expect(host.querySelector('.mk-field__hint')).toBeNull()
  })

  it('translates the error in the active language', () => {
    const fixture = render({ kind: 'required' })
    TestBed.inject(TranslocoService).setActiveLang('es')
    fixture.detectChanges()

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Este campo es obligatorio'
    )
  })

  it('a message produced by the validator wins over the catalogue', () => {
    const host = render({ kind: 'custom', message: 'Already taken' }).nativeElement as HTMLElement

    expect(host.querySelector('[role="alert"]')?.textContent?.trim()).toBe('Already taken')
  })
})
