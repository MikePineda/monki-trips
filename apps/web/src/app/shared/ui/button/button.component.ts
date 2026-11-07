import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkIconComponent } from '../icon/icon.component'
import { provideUiI18n } from '../ui-i18n'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

/**
 * The app's button, applied to a native `<button>` or `<a>` so semantics,
 * keyboard handling and forms keep working: `<button mk-button>Save</button>`.
 * Three variants; `loading` disables it and announces busy; the accent is
 * the only colour fill (interaction only, never data).
 */
@Component({
  selector: 'button[mk-button], a[mk-button]',
  imports: [MkIconComponent, TranslocoPipe],
  providers: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'mk-button',
    '[class.mk-button--primary]': 'variant() === "primary"',
    '[class.mk-button--secondary]': 'variant() === "secondary"',
    '[class.mk-button--ghost]': 'variant() === "ghost"',
    '[class.mk-button--loading]': 'loading()',
    '[attr.disabled]': 'inactive() ? "" : null',
    '[attr.aria-disabled]': 'inactive() ? "true" : null',
    '[attr.aria-busy]': 'loading() ? "true" : null',
  },
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      min-height: 2.75rem;
      padding: 0 1rem;
      border: 1px solid transparent;
      border-radius: 8px;
      font: inherit;
      font-weight: 500;
      line-height: 1.25;
      text-decoration: none;
      cursor: pointer;
      transition: background-color 150ms ease-out;
    }
    :host(.mk-button--primary) {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--surface-1);
    }
    :host(.mk-button--secondary) {
      background: var(--surface-1);
      border-color: var(--line-strong);
      color: var(--ink-1);
    }
    :host(.mk-button--ghost) {
      background: transparent;
      color: var(--accent);
    }
    :host([disabled]) {
      cursor: not-allowed;
      opacity: 0.55;
    }
    .mk-button__spinner {
      animation: mk-spin 900ms linear infinite;
    }
    @keyframes mk-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  template: `
    @if (loading()) {
      <mk-icon
        class="mk-button__spinner"
        name="loader-circle"
        [size]="18"
        [label]="'ui.button.loading' | transloco"
      />
    }
    <ng-content />
  `,
})
export class MkButtonComponent {
  readonly variant = input<ButtonVariant>('primary')
  readonly loading = input(false)
  readonly disabled = input(false)

  protected readonly inactive = computed(() => this.disabled() || this.loading())
}
