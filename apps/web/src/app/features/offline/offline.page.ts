import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { ConnectionStatusStore } from '../../core/offline/connection-status.store'
import { MkConnectionStatusComponent } from '../../shared/ui/connection-status/connection-status.component'
import { provideOfflineI18n } from './offline-i18n'

/**
 * The offline page (`more/offline`): today only the live connection state
 * and a placeholder for "Ready to fly" (WP 2.5).
 */
@Component({
  selector: 'app-offline-page',
  imports: [TranslocoPipe, MkConnectionStatusComponent],
  providers: [provideOfflineI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl font-semibold text-ink-1">{{ 'offline.title' | transloco }}</h1>
    <section class="mt-6">
      <h2 class="text-sm font-medium text-ink-2">{{ 'offline.status.label' | transloco }}</h2>
      <div class="mt-2 text-sm text-ink-1" data-testid="offline.status">
        @if (connection.status().state === 'synced') {
          {{ 'offline.status.synced' | transloco }}
        } @else {
          <mk-connection-status [status]="connection.status()" />
        }
      </div>
    </section>
    <section
      class="mt-8 rounded-lg border border-line bg-surface-1 p-4"
      data-testid="offline.ready"
    >
      <h2 class="font-medium text-ink-1">{{ 'offline.ready.title' | transloco }}</h2>
      <p class="mt-2 text-sm text-ink-2">{{ 'offline.ready.body' | transloco }}</p>
    </section>
  `,
})
export default class OfflinePage {
  protected readonly connection = inject(ConnectionStatusStore)
}
