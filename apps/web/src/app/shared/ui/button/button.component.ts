import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkIconComponent } from '../icon/icon.component'
import { provideUiI18n } from '../ui-i18n'

/**
 * primary: accent fill (at most one per screen). secondary: surface-1 with
 * a line-strong hairline. ghost: the quiet link ("Undo", "I printed it").
 * destructive: secondary with a status-critical label, never a red fill.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'

/** md 44 px; sm 36 px with a 44 px hit area; block 48 px and full width (sheet footer). */
export type ButtonSize = 'md' | 'sm' | 'block'

/**
 * The app's button, applied to a native `<button>` or `<a>` so semantics,
 * keyboard handling and forms keep working: `<button mk-button>Save</button>`.
 * `loading` disables it and announces busy; the accent is the only colour
 * fill (interaction only, never data). Icons are projected content.
 */
@Component({
  selector: 'button[mk-button], a[mk-button]',
  imports: [MkIconComponent, TranslocoPipe],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'mk-button mk-type-body-strong',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
    '[class.mk-button--loading]': 'loading()',
    '[attr.disabled]': 'inactive() ? "" : null',
    '[attr.aria-disabled]': 'inactive() ? "true" : null',
    '[attr.aria-busy]': 'loading() ? "true" : null',
  },
  styles: `
    :host {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-1);
      min-height: var(--tap-target);
      padding: 0 var(--space-2);
      border: 1px solid transparent;
      border-radius: var(--radius-md);
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
      transition: background-color var(--duration-fast) var(--ease-out);
    }
    :host([data-variant='primary']) {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-ink);
    }
    :host([data-variant='secondary']),
    :host([data-variant='destructive']) {
      background: var(--surface-1);
      border-color: var(--line-strong);
      color: var(--ink-1);
      font-weight: 500;
    }
    :host([data-variant='destructive']) {
      color: var(--status-critical);
    }
    :host([data-variant='ghost']) {
      background: transparent;
      color: var(--accent);
      padding: 0 var(--space-1);
    }
    :host([data-size='sm']) {
      min-height: 36px;
      padding: 0 var(--space-1);
      font-size: 14px;
    }
    /* The pseudo element sits inside the 1 px border: 34 + 2 × 5 = 44 px. */
    :host([data-size='sm'])::after {
      content: '';
      position: absolute;
      inset: -5px -1px;
    }
    :host([data-size='block']) {
      display: flex;
      width: 100%;
      min-height: var(--space-6);
    }
    :host(:active:not([disabled])[data-variant='secondary']),
    :host(:active:not([disabled])[data-variant='destructive']),
    :host(:active:not([disabled])[data-variant='ghost']) {
      background: var(--surface-2);
    }
    :host([disabled]) {
      background: var(--surface-2);
      border-color: var(--line);
      color: var(--ink-3);
      cursor: not-allowed;
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
        [size]="20"
        [label]="'ui.button.loading' | transloco"
      />
    }
    <ng-content />
  `,
})
export class MkButtonComponent {
  readonly variant = input<ButtonVariant>('primary')
  readonly size = input<ButtonSize>('md')
  readonly loading = input(false)
  readonly disabled = input(false)

  protected readonly inactive = computed(() => this.disabled() || this.loading())
}
