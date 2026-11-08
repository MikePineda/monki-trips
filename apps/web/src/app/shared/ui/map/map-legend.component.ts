import { ChangeDetectionStrategy, Component, input } from '@angular/core'

export interface MapLegendItem {
  label: string
  /** `--series-1` … `--series-8`, as on the map. */
  series: number
  meta?: string
}

/**
 * The key of `mk-map`: one line per trip with the dot colour its pins and
 * route carry on the map, its name and an optional mono line (dates).
 * Colour is never the only cue: the map's pins carry the place as a title.
 */
@Component({
  selector: 'mk-map-legend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-map-legend' },
  styles: `
    :host {
      display: block;
    }
    ul {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      align-items: baseline;
      gap: var(--space-1);
      min-width: 0;
    }
    .mk-map-legend__dot {
      flex: none;
      width: 12px;
      height: 12px;
      border-radius: var(--radius-full);
      align-self: center;
    }
    .mk-map-legend__label {
      flex: 1 1 0;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      color: var(--ink-1);
    }
    .mk-map-legend__meta {
      flex: none;
      color: var(--ink-3);
    }
  `,
  template: `
    <ul>
      @for (item of items(); track $index) {
        <li data-testid="mk-map-legend.item">
          <span
            class="mk-map-legend__dot"
            aria-hidden="true"
            [style.background]="'var(--series-' + item.series + ')'"
          ></span>
          <span class="mk-map-legend__label mk-type-body">{{ item.label }}</span>
          @if (item.meta; as meta) {
            <span class="mk-map-legend__meta mk-type-code-label">{{ meta }}</span>
          }
        </li>
      }
    </ul>
  `,
})
export class MkMapLegendComponent {
  readonly items = input.required<readonly MapLegendItem[]>()
}
