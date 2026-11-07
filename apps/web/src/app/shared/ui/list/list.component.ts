import { ChangeDetectionStrategy, Component } from '@angular/core'

/**
 * A list of `mk-list-row` / `mk-event-row`: announced as a list, rows
 * separated by `line` hairlines (drawn by the rows), never boxed.
 */
@Component({
  selector: 'mk-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-list', role: 'list' },
  styles: `
    :host {
      display: block;
    }
  `,
  template: `<ng-content />`,
})
export class MkListComponent {}
