import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import type { Space } from './space'

/**
 * The narrowest a column may get: `sm` 96 px, `md` 140 px (two passport
 * stamps per row on a 360–390 px phone, three from about 470 px), `lg`
 * 200 px.
 */
export type GridColumn = 'sm' | 'md' | 'lg'

/**
 * Equal columns, as many as fit: `<mk-grid gap="1" column="md">`. Each child
 * takes one cell and is centred in it; rows grow with their tallest child.
 * Features lay out tiles with it instead of styling a grid themselves.
 */
@Component({
  selector: 'mk-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'mk-grid',
    '[attr.data-gap]': 'gap()',
    '[attr.data-column]': 'column()',
  },
  styles: `
    :host {
      --mk-grid-column: 140px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(var(--mk-grid-column), 100%), 1fr));
      justify-items: center;
      align-items: start;
      min-width: 0;
    }
    :host([data-column='sm']) {
      --mk-grid-column: 96px;
    }
    :host([data-column='lg']) {
      --mk-grid-column: 200px;
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
  `,
  template: `<ng-content />`,
})
export class MkGridComponent {
  readonly gap = input<Space>('1')
  readonly column = input<GridColumn>('md')
}
