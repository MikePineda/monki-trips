import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import type { ConnectionState, ConnectionStatus } from '../../../domain/connection-status'
import { MkIconComponent } from '../icon/icon.component'
import type { IconName } from '../icon/icon-names'
import { provideUiI18n } from '../ui-i18n'

const ICONS: Record<Exclude<ConnectionState, 'synced'>, IconName> = {
  failed: 'alert-triangle',
  offline: 'wifi-off',
  syncing: 'refresh-cw',
  pending: 'cloud-off',
  stale: 'info',
}

/**
 * The connection indicator in the shell header: icon + copy for one derived
 * state (domain/connection-status.ts); nothing at all when synced. Status
 * colours always come with the icon and the text, never alone.
 */
@Component({
  selector: 'mk-connection-status',
  imports: [MkIconComponent, TranslocoPipe],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-connection-status' },
  styles: `
    :host {
      display: inline-flex;
    }
    .mk-connection {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--ink-2);
      font-variant-numeric: tabular-nums;
    }
    .mk-connection--failed {
      color: var(--status-serious);
    }
    .mk-connection--stale {
      color: var(--status-warning);
    }
  `,
  template: `
    @if (status(); as status) {
      @if (status.state !== 'synced') {
        <span
          class="mk-connection"
          [class]="'mk-connection mk-connection--' + status.state"
          role="status"
          data-testid="shell.connection"
          [attr.data-state]="status.state"
        >
          <mk-icon [name]="icon()!" [size]="16" />
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
    return state === 'synced' ? null : ICONS[state]
  })

  protected readonly key = computed(() => {
    const { state, count } = this.status()
    if (state === 'failed' || state === 'pending' || state === 'stale') {
      return `ui.connection.${state}${count === 1 ? 'One' : 'Other'}`
    }
    return `ui.connection.${state}`
  })
}
