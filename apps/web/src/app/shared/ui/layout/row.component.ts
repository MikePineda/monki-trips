import { ChangeDetectionStrategy, Component, Directive, input } from '@angular/core'
import type { Space } from './space'

export type RowAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch'
export type RowJustify = 'start' | 'between' | 'end' | 'center'

/**
 * Horizontal flow with a token gap: `<mk-row gap="1" justify="between">`.
 * `wrap` lets chips flow to the next line; `mkRowGrow` (MkRowGrowDirective)
 * marks the child that takes the remaining width.
 */
@Component({
  selector: 'mk-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'mk-row',
    '[attr.data-gap]': 'gap()',
    '[attr.data-align]': 'align()',
    '[attr.data-justify]': 'justify()',
    '[attr.data-wrap]': 'wrap() ? "" : null',
  },
  styles: `
    :host {
      display: flex;
      flex-direction: row;
      align-items: center;
      min-width: 0;
    }
    :host([data-wrap]) {
      flex-wrap: wrap;
    }
    :host([data-gap='half']) {
      gap: var(--space-half);
    }
    :host([data-gap='1']) {
      gap: var(--space-1);
    }
    :host([data-gap='2']) {
      gap: var(--space-2);
    }
    :host([data-gap='3']) {
      gap: var(--space-3);
    }
    :host([data-gap='4']) {
      gap: var(--space-4);
    }
    :host([data-gap='6']) {
      gap: var(--space-6);
    }
    :host([data-align='start']) {
      align-items: flex-start;
    }
    :host([data-align='end']) {
      align-items: flex-end;
    }
    :host([data-align='baseline']) {
      align-items: baseline;
    }
    :host([data-align='stretch']) {
      align-items: stretch;
    }
    :host([data-justify='between']) {
      justify-content: space-between;
    }
    :host([data-justify='end']) {
      justify-content: flex-end;
    }
    :host([data-justify='center']) {
      justify-content: center;
    }
  `,
  template: `<ng-content />`,
})
export class MkRowComponent {
  readonly gap = input<Space>('1')
  readonly align = input<RowAlign>('center')
  readonly justify = input<RowJustify>('start')
  readonly wrap = input(false)
}

/** The child of a row (or a stack) that takes the remaining space: `<span mkRowGrow>`. */
@Directive({ selector: '[mkRowGrow]', host: { class: 'mk-grow' } })
export class MkRowGrowDirective {}
