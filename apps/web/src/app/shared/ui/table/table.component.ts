import { ChangeDetectionStrategy, Component, input } from '@angular/core'

export interface TableColumn {
  id: string
  /** Already translated. */
  label: string
  /** Figures align at the end. */
  align?: 'start' | 'end'
}

export interface TableRow {
  id: string
  /** Cell text by column id, already formatted. */
  cells: Readonly<Record<string, string>>
}

/**
 * The table view every chart offers: a real `<table>` with a caption for
 * screen readers, hairline rows, header in eyebrow / ink-3, figures in
 * tabular numbers aligned at the end. No zebra, no boxes.
 */
@Component({
  selector: 'mk-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-table' },
  styles: `
    :host {
      display: block;
      overflow-x: auto;
      color: var(--ink-1);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    caption {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    th {
      padding: var(--space-1) var(--space-1) var(--space-1) 0;
      border-bottom: 1px solid var(--line-strong);
      color: var(--ink-3);
      text-align: start;
    }
    td {
      padding: var(--space-1) var(--space-1) var(--space-1) 0;
      border-bottom: 1px solid var(--line);
      font-variant-numeric: tabular-nums;
    }
    [data-align='end'] {
      text-align: end;
      white-space: nowrap;
    }
    th:last-child,
    td:last-child {
      padding-right: 0;
    }
  `,
  template: `
    <table>
      <caption>
        {{
          caption()
        }}
      </caption>
      <thead>
        <tr>
          @for (column of columns(); track column.id) {
            <th class="mk-type-eyebrow" scope="col" [attr.data-align]="column.align ?? 'start'">
              {{ column.label }}
            </th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.id) {
          <tr [attr.data-testid]="testId() ? testId() + '.row' : null" [attr.data-row-id]="row.id">
            @for (column of columns(); track column.id) {
              <td
                class="mk-type-body"
                [attr.data-align]="column.align ?? 'start'"
                [attr.data-column]="column.id"
              >
                {{ row.cells[column.id] ?? '' }}
              </td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class MkTableComponent {
  readonly caption = input.required<string>()
  readonly columns = input.required<readonly TableColumn[]>()
  readonly rows = input.required<readonly TableRow[]>()
  readonly testId = input<string>()
}
