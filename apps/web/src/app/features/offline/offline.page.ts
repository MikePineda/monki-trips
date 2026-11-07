import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { ConnectionStatusStore } from '../../core/offline/connection-status.store'
import { MkConnectionStatusComponent } from '../../shared/ui/connection-status/connection-status.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { provideOfflineI18n } from './offline-i18n'

/**
 * The offline page (`more/offline`): today only the live connection state
 * and a placeholder for "Ready to fly" (WP 2.5).
 */
@Component({
  selector: 'app-offline-page',
  imports: [
    TranslocoPipe,
    MkConnectionStatusComponent,
    MkSectionComponent,
    MkStackComponent,
    MkTextComponent,
  ],
  providers: [provideOfflineI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="2">
      <h1 mk-text variant="title">{{ 'offline.title' | transloco }}</h1>
      <mk-section [eyebrow]="'offline.status.label' | transloco">
        <div mk-text data-testid="offline.status">
          @if (connection.status().state === 'synced') {
            {{ 'offline.status.synced' | transloco }}
          } @else {
            <mk-connection-status [status]="connection.status()" />
          }
        </div>
      </mk-section>
      <mk-section [title]="'offline.ready.title' | transloco" data-testid="offline.ready">
        <p mk-text tone="ink-2">{{ 'offline.ready.body' | transloco }}</p>
      </mk-section>
    </mk-stack>
  `,
})
export default class OfflinePage {
  protected readonly connection = inject(ConnectionStatusStore)
}
