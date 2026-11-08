import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkIconButtonComponent } from '../icon-button/icon-button.component'
import { MkIconComponent } from '../icon/icon.component'
import { provideUiI18n } from '../ui-i18n'
import { ToastService } from './toast.service'

/**
 * Renders the toast queue 16 px above the tab bar, one status region per
 * toast (polite: toasts never steal focus): `surface-1`, 1px `line`, radius
 * 12, level-1 elevation, one sentence and one quiet action ("Undo"). Place
 * it once in the root component.
 */
@Component({
  selector: 'mk-toast-host',
  imports: [MkIconComponent, MkIconButtonComponent, TranslocoPipe],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The live region exists before any toast: one inserted with its own role is often not announced.
  host: { 'class': 'mk-toast-host', 'role': 'status', 'aria-live': 'polite' },
  styles: `
    :host {
      position: fixed;
      inset-inline: 0;
      bottom: calc(var(--tab-bar-height) + env(safe-area-inset-bottom, 0px) + var(--space-2));
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      padding: 0 var(--space-2);
      pointer-events: none;
      z-index: 50;
    }
    .mk-toast {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      width: 100%;
      max-width: calc(var(--container-max) - 2 * var(--space-2));
      min-height: var(--tap-target);
      padding: var(--space-half) var(--space-half) var(--space-half) var(--space-2);
      box-sizing: border-box;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: var(--surface-1);
      color: var(--ink-1);
      box-shadow: var(--elevation-1);
      pointer-events: auto;
      animation: mk-toast-in var(--duration-fast) var(--ease-out);
    }
    .mk-toast__message {
      flex: 1 1 0;
      font: 500 14px/20px var(--font-sans);
    }
    .mk-toast__action {
      min-height: 36px;
      padding: 0 var(--space-1);
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--accent);
      font: 600 14px/20px var(--font-sans);
      cursor: pointer;
    }
    @keyframes mk-toast-in {
      from {
        opacity: 0;
        transform: translateY(var(--space-1));
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .mk-toast {
        animation: mk-toast-fade 100ms linear;
      }
      @keyframes mk-toast-fade {
        from {
          opacity: 0;
        }
      }
    }
  `,
  template: `
    @for (toast of toasts.toasts(); track toast.id) {
      <div class="mk-toast" data-testid="ui.toast">
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
          mk-icon-button
          size="sm"
          type="button"
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
