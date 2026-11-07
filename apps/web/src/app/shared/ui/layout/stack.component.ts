import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import type { Space } from './space'

export type StackAlign = 'stretch' | 'start' | 'center' | 'end'

/**
 * Vertical flow with a token gap: `<mk-stack gap="2">`. The only way a
 * feature spaces things vertically; the step names map to `--space-*`.
 */
@Component({
  selector: 'mk-stack',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'mk-stack',
    '[attr.data-gap]': 'gap()',
    '[attr.data-align]': 'align()',
  },
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-width: 0;
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
    :host([data-gap='5']) {
      gap: var(--space-5);
    }
    :host([data-gap='6']) {
      gap: var(--space-6);
    }
    :host([data-gap='7']) {
      gap: var(--space-7);
    }
    :host([data-gap='8']) {
      gap: var(--space-8);
    }
    :host([data-align='start']) {
      align-items: flex-start;
    }
    :host([data-align='center']) {
      align-items: center;
    }
    :host([data-align='end']) {
      align-items: flex-end;
    }
  `,
  template: `<ng-content />`,
})
export class MkStackComponent {
  readonly gap = input<Space>('1')
  readonly align = input<StackAlign>('stretch')
}
