import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { provideUiI18n } from '../ui-i18n'

/**
 * Loading placeholder: a few hairline rows that shimmer (still when the
 * person prefers reduced motion), announced once as "Loading…".
 */
@Component({
  selector: 'mk-skeleton',
  imports: [TranslocoPipe],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-skeleton', 'role': 'status', 'aria-busy': 'true' },
  styles: `
    :host {
      display: block;
    }
    .mk-skeleton__row {
      height: 0.75rem;
      margin: 0.75rem 0;
      border-radius: 4px;
      background: var(--surface-2);
      border-bottom: 1px solid var(--line);
      animation: mk-shimmer 1.2s ease-in-out infinite alternate;
    }
    .mk-skeleton__row:nth-child(even) {
      width: 70%;
    }
    .mk-skeleton__label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    @keyframes mk-shimmer {
      to {
        opacity: 0.45;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .mk-skeleton__row {
        animation: none;
      }
    }
  `,
  template: `
    <span class="mk-skeleton__label">{{ 'ui.skeleton.loading' | transloco }}</span>
    @for (row of rowList(); track row) {
      <div class="mk-skeleton__row" aria-hidden="true"></div>
    }
  `,
})
export class MkSkeletonComponent {
  readonly rows = input(3)

  protected readonly rowList = computed(() => Array.from({ length: this.rows() }, (_, i) => i))
}
