import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import type { ConnectionState, ConnectionStatus } from '../../../domain/connection-status'
import { MkIconComponent } from '../icon/icon.component'
import type { IconName } from '../icon/icon-names'
import { provideUiI18n } from '../ui-i18n'

/** pending has no icon: an 8 px ink-3 dot. */
const ICONS: Record<Exclude<ConnectionState, 'synced' | 'pending'>, IconName> = {
  failed: 'circle-x',
  offline: 'wifi-off',
  syncing: 'refresh-cw',
  stale: 'clock',
}

/**
 * The one line under the header title, by priority failed > offline >
 * syncing > pending > stale > synced (hidden). offline is calm (`offline`
 * = ink-2); stale takes the warning colour and failed the critical one on
 * the icon only, the words stay in ink.
 */
@Component({
  selector: 'mk-connection-status',
  imports: [MkIconComponent, TranslocoPipe],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // A live region that exists while synced too, so the first change of state is announced.
  host: { 'class': 'mk-connection-status', 'role': 'status', 'aria-live': 'polite' },
  styles: `
    :host {
      display: inline-flex;
    }
    .mk-connection {
      display: inline-flex;
      align-items: center;
      gap: var(--space-half);
      color: var(--ink-2);
    }
    .mk-connection--offline {
      color: var(--offline);
    }
    .mk-connection--failed mk-icon {
      color: var(--status-critical);
    }
    .mk-connection--stale mk-icon {
      color: var(--status-warning);
    }
    .mk-connection__dot {
      width: var(--space-1);
      height: var(--space-1);
      border-radius: var(--radius-full);
      background: var(--ink-3);
    }
  `,
  template: `
    @if (status(); as status) {
      @if (status.state !== 'synced') {
        <span
          [class]="'mk-connection mk-type-label mk-connection--' + status.state"
          data-testid="shell.connection"
          [attr.data-state]="status.state"
        >
          @if (icon(); as icon) {
            <mk-icon [name]="icon" [size]="16" />
          } @else {
            <span class="mk-connection__dot" aria-hidden="true"></span>
          }
          <span>{{ key() | transloco: { count: status.count } }}</span>
        </span>
      }
    }
  `,
})
export class MkConnectionStatusComponent {
  readonly status = input.required<ConnectionStatus>()

  protected readonly icon = computed(() => {
    const state = this.status().state
    return state === 'synced' || state === 'pending' ? null : ICONS[state]
  })

  protected readonly key = computed(() => {
    const { state, count } = this.status()
    if (state === 'failed' || state === 'pending' || state === 'stale') {
      return `ui.connection.${state}${count === 1 ? 'One' : 'Other'}`
    }
    return `ui.connection.${state}`
  })
}
