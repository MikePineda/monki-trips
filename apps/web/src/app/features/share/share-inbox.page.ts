import { ChangeDetectionStrategy, Component } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'

/**
 * Where the Share Target lands (`/share`): the service worker stores the
 * shared files in the `share-inbox` IndexedDB database and redirects here.
 * Reading that inbox arrives with WP 2.8; until then an honest placeholder.
 */
@Component({
  selector: 'app-share-inbox-page',
  imports: [TranslocoPipe, MkEmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-empty-state
      icon="inbox"
      [title]="'shell.share.title' | transloco"
      [body]="'shell.share.body' | transloco"
      data-testid="share.placeholder"
    />
  `,
})
export default class ShareInboxPage {}
