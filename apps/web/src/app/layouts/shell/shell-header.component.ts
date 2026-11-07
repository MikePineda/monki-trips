import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { ConnectionStatusStore } from '../../core/offline/connection-status.store'
import { UpdateService } from '../../core/pwa/update.service'
import { MkConnectionStatusComponent } from '../../shared/ui/connection-status/connection-status.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'

/**
 * The header every frame shares: an optional back link, the title, the
 * connection indicator and, when the cached build is broken, a full-width
 * banner offering a reload. Lives under the `shell` scope of its frame.
 */
@Component({
  selector: 'app-shell-header',
  imports: [RouterLink, TranslocoPipe, MkConnectionStatusComponent, MkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (updates.unrecoverable()) {
      <div
        class="flex items-center justify-between gap-3 border-b border-status-serious bg-surface-2 px-4 py-2 text-sm text-ink-1"
        role="alert"
        data-testid="shell.unrecoverable"
      >
        <span>{{ 'shell.banner.unrecoverable' | transloco }}</span>
        <button type="button" class="font-medium text-accent" (click)="updates.reload()">
          {{ 'shell.banner.reload' | transloco }}
        </button>
      </div>
    }
    <header class="border-b border-line bg-surface-1">
      <div class="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
        @if (backLink(); as back) {
          <a
            [routerLink]="back"
            class="-ml-2 inline-flex size-10 items-center justify-center rounded-full text-ink-2"
            [attr.aria-label]="'shell.nav.back' | transloco"
            data-testid="shell.back"
          >
            <mk-icon name="arrow-left" />
          </a>
        }
        <span class="min-w-0 flex-1 truncate font-semibold text-ink-1" data-testid="shell.name">{{
          title()
        }}</span>
        <mk-connection-status [status]="connection.status()" />
        <ng-content />
      </div>
    </header>
  `,
})
export class ShellHeaderComponent {
  readonly title = input.required<string>()
  readonly backLink = input<string | readonly string[]>()

  protected readonly connection = inject(ConnectionStatusStore)
  protected readonly updates = inject(UpdateService)
}
