import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { provideUiI18n } from '../ui-i18n'

/** bar: one 4 px track. steps: equal segments with 2 px gaps (checklists). */
export type ProgressVariant = 'bar' | 'steps'

/**
 * Progress reports, it is not a control: a 4 px `surface-2` track with an
 * `ink-1` fill and rounded ends, never accent, never a status colour, with
 * the count written next to the label ("12 of 18").
 */
@Component({
  selector: 'mk-progress',
  imports: [TranslocoPipe],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-progress', '[attr.data-variant]': 'variant()' },
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-half);
      color: var(--ink-1);
    }
    .mk-progress__header {
      display: flex;
      justify-content: space-between;
      gap: var(--space-1);
    }
    .mk-progress__count {
      color: var(--ink-2);
    }
    .mk-progress__track {
      display: flex;
      gap: 2px;
      height: 4px;
      border-radius: var(--radius-full);
      overflow: hidden;
      background: var(--surface-2);
    }
    :host([data-variant='steps']) .mk-progress__track {
      background: transparent;
    }
    .mk-progress__fill {
      height: 100%;
      border-radius: var(--radius-full);
      background: var(--ink-1);
    }
    .mk-progress__step {
      flex: 1 1 0;
      height: 100%;
      border-radius: var(--radius-full);
      background: var(--surface-2);
    }
    .mk-progress__step[data-done] {
      background: var(--ink-1);
    }
  `,
  template: `
    <div class="mk-progress__header">
      <span class="mk-type-label">{{ label() }}</span>
      <span class="mk-progress__count mk-type-caption" data-testid="ui.progress.count">{{
        'ui.progress.count' | transloco: { value: value(), max: max() }
      }}</span>
    </div>
    <div
      class="mk-progress__track"
      role="progressbar"
      [attr.aria-label]="label()"
      [attr.aria-valuenow]="value()"
      aria-valuemin="0"
      [attr.aria-valuemax]="max()"
    >
      @if (variant() === 'bar') {
        <div class="mk-progress__fill" [style.width.%]="percent()"></div>
      } @else {
        @for (step of steps(); track $index) {
          <div class="mk-progress__step" [attr.data-done]="step ? '' : null"></div>
        }
      }
    </div>
  `,
})
export class MkProgressComponent {
  readonly label = input.required<string>()
  readonly value = input.required<number>()
  readonly max = input.required<number>()
  readonly variant = input<ProgressVariant>('bar')

  protected readonly percent = computed(() =>
    this.max() > 0 ? Math.min(100, Math.max(0, (this.value() / this.max()) * 100)) : 0
  )
  protected readonly steps = computed(() =>
    Array.from({ length: Math.max(0, this.max()) }, (_, index) => index < this.value())
  )
}
