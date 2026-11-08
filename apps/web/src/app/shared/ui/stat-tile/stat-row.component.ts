import { ChangeDetectionStrategy, Component } from '@angular/core'

/**
 * The row of up to three stat tiles. It is the container the tiles size
 * against (`container-type: inline-size`): each tile starts at its own
 * content width and grows to share the line, so when long values do not
 * fit side by side the row wraps (2 + 1) and, in a very narrow column,
 * stacks; a value is never drawn over its neighbour nor cut short. The
 * vertical `line` hairline sits after each tile; the one at the end of a
 * line falls outside the row and is clipped.
 */
@Component({
  selector: 'mk-stat-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-stat-row' },
  styles: `
    :host {
      display: block;
      container-type: inline-size;
      overflow: hidden;
    }
    .mk-stat-row__tiles {
      display: flex;
      flex-wrap: wrap;
      row-gap: var(--space-2);
      /* Room for the hairline and the gap after the last tile of each line, clipped by the host. */
      margin-right: calc(-1 * (var(--space-2) + 1px));
    }
  `,
  template: `<div class="mk-stat-row__tiles"><ng-content /></div>`,
})
export class MkStatRowComponent {}
