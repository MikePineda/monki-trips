import { Directive, input } from '@angular/core'

export type InputVariant = 'text' | 'code'

/**
 * Marks the native control projected into `<mk-field>`: `<input mkInput>`.
 * The field's global styles key on the class; `code` sets the mono look for
 * booking references and codes. Features never use a bare `<input>`.
 */
@Directive({
  selector: 'input[mkInput], select[mkInput], textarea[mkInput]',
  host: { 'class': 'mk-input', '[attr.data-variant]': 'variant()' },
})
export class MkInputDirective {
  readonly variant = input<InputVariant>('text')
}
