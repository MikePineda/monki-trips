import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { MkIconComponent } from '../icon/icon.component'
import type { IconName } from '../icon/icon-names'

/** One bar: a value against an optional target on the chart's single axis. */
export interface ChartBar {
  id: string
  /** Already translated. */
  label: string
  value: number
  /** The target the value is measured against (a budget); null draws the value alone. */
  target: number | null
  /** The value as the reader should see it (formatted money). */
  valueText: string
  /** The target written out ("of €300", "No budget"). */
  targetText: string
  /** A bar that means good or bad says so with an icon and a word, never by colour alone. */
  status?: { tone: 'warning' | 'serious' | 'critical'; icon: IconName; label: string }
}

/**
 * Horizontal bars on one value axis, single series in `mark-neutral`: for
 * each row the label and its figures above a 12 px bar whose length is the
 * value; a target shows as a `surface-2` track up to the target with a
 * `baseline` tick at its end. Bars are 4 px rounded at the data end and
 * square at the baseline; values below zero draw nothing. Every chart has a
 * table view: the consumer renders `mk-table` with the same rows behind a
 * "Chart | Table" segmented control.
 */
@Component({
  selector: 'mk-bar-chart',
  imports: [MkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-bar-chart', role: 'list' },
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      color: var(--ink-1);
    }
    .mk-bar {
      display: flex;
      flex-direction: column;
      gap: var(--space-half);
    }
    .mk-bar__head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 0 var(--space-1);
    }
    .mk-bar__label {
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    /* Too wide beside the label: the figures take the next line, still at the right. */
    .mk-bar__figures {
      margin-left: auto;
      text-align: end;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .mk-bar__target {
      color: var(--ink-2);
    }
    .mk-bar__status {
      display: inline-flex;
      align-items: center;
      gap: var(--space-half);
      color: var(--ink-2);
    }
    .mk-bar[data-tone='warning'] .mk-bar__status mk-icon {
      color: var(--status-warning);
    }
    .mk-bar[data-tone='serious'] .mk-bar__status mk-icon {
      color: var(--status-serious);
    }
    .mk-bar[data-tone='critical'] .mk-bar__status mk-icon {
      color: var(--status-critical);
    }
    .mk-bar__plot {
      position: relative;
      height: 12px;
      border-left: 1px solid var(--baseline);
    }
    .mk-bar__track,
    .mk-bar__fill,
    .mk-bar__tick {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
    }
    .mk-bar__track {
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      background: var(--surface-2);
    }
    .mk-bar__fill {
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      background: var(--mark-neutral);
    }
    .mk-bar__tick {
      width: 2px;
      margin-left: -1px;
      background: var(--baseline);
    }
  `,
  template: `
    @for (bar of drawn(); track bar.id) {
      <div
        class="mk-bar"
        role="listitem"
        [attr.data-tone]="bar.status?.tone"
        [attr.data-testid]="testId() ? testId() + '.bar' : null"
        [attr.data-bar-id]="bar.id"
      >
        <div class="mk-bar__head">
          <span class="mk-bar__label mk-type-label" data-testid="ui.barChart.label">{{
            bar.label
          }}</span>
          <span class="mk-bar__figures mk-type-label">
            <span data-testid="ui.barChart.value">{{ bar.valueText }}</span>
            <span class="mk-bar__target" data-testid="ui.barChart.target">
              · {{ bar.targetText }}</span
            >
          </span>
        </div>
        <div class="mk-bar__plot" aria-hidden="true">
          @if (bar.trackPct !== null) {
            <div class="mk-bar__track" [style.width.%]="bar.trackPct"></div>
          }
          <div class="mk-bar__fill" [style.width.%]="bar.valuePct"></div>
          @if (bar.trackPct !== null) {
            <div class="mk-bar__tick" [style.left.%]="bar.trackPct"></div>
          }
        </div>
        @if (bar.status; as status) {
          <span class="mk-bar__status mk-type-caption">
            <mk-icon [name]="status.icon" [size]="16" />
            {{ status.label }}
          </span>
        }
      </div>
    }
  `,
})
export class MkBarChartComponent {
  readonly bars = input.required<readonly ChartBar[]>()
  readonly testId = input<string>()

  /** Every bar on the same axis: the largest value or target is the full width. */
  protected readonly drawn = computed(() => {
    const bars = this.bars()
    const max = Math.max(0, ...bars.map((bar) => Math.max(bar.value, bar.target ?? 0)))
    const pct = (value: number) => (max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0)
    return bars.map((bar) => ({
      ...bar,
      valuePct: pct(bar.value),
      trackPct: bar.target === null ? null : pct(bar.target),
    }))
  })
}
