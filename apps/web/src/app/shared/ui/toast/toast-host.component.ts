import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkIconComponent } from '../icon/icon.component'
import { provideUiI18n } from '../ui-i18n'
import { ToastService } from './toast.service'

/**
 * Renders the toast queue above the tab bar, one status region per toast
 * (polite: toasts never steal focus). Place it once in the root component.
 */
@Component({
  selector: 'mk-toast-host',
  imports: [MkIconComponent, TranslocoPipe],
  providers: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-toast-host' },
  styles: `
    :host {
      position: fixed;
      inset-inline: 0;
      bottom: calc(var(--mk-tab-bar-height, 0px) + env(safe-area-inset-bottom, 0px) + 0.75rem);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 0 1rem;
      pointer-events: none;
      z-index: 50;
    }
    .mk-toast {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      max-width: 28rem;
      min-height: 2.75rem;
      padding: 0.5rem 0.5rem 0.5rem 1rem;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--surface-1);
      color: var(--ink-1);
      font-size: 0.875rem;
      box-shadow: 0 1px 2px color-mix(in srgb, var(--ink-1) 12%, transparent);
      pointer-events: auto;
      transition: opacity 150ms ease-out;
    }
    .mk-toast__message {
      flex: 1;
    }
    .mk-toast__action,
    .mk-toast__dismiss {
      border: 0;
      background: transparent;
      font: inherit;
      cursor: pointer;
      min-height: 2.25rem;
    }
    .mk-toast__action {
      padding: 0 0.5rem;
      font-weight: 500;
      color: var(--accent);
    }
    .mk-toast__dismiss {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      color: var(--ink-3);
    }
  `,
  template: `
    @for (toast of toasts.toasts(); track toast.id) {
      <div class="mk-toast" role="status" data-testid="ui.toast">
        <span class="mk-toast__message">{{ toast.message }}</span>
        @if (toast.action; as action) {
          <button
            type="button"
            class="mk-toast__action"
            data-testid="ui.toast.action"
            (click)="toasts.act(toast.id)"
          >
            {{ action.label ?? ('ui.toast.undo' | transloco) }}
          </button>
        }
        <button
          type="button"
          class="mk-toast__dismiss"
          data-testid="ui.toast.dismiss"
          [attr.aria-label]="'ui.toast.dismiss' | transloco"
          (click)="toasts.dismiss(toast.id)"
        >
          <mk-icon name="x" [size]="16" />
        </button>
      </div>
    }
  `,
})
export class MkToastHostComponent {
  protected readonly toasts = inject(ToastService)
}
