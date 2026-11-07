import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { ConnectionStatusStore } from '../../core/offline/connection-status.store'
import { UpdateService } from '../../core/pwa/update.service'
import { MkBannerComponent } from '../../shared/ui/banner/banner.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkConnectionStatusComponent } from '../../shared/ui/connection-status/connection-status.component'
import { MkTopBarComponent } from '../../shared/ui/top-bar/top-bar.component'

/**
 * The header every frame shares: the top bar with an optional back link,
 * the title, the connection indicator under it and the frame's actions
 * (`[mkTopBarActions]`), and, when the cached build is broken, a critical
 * banner offering a reload. Lives under the `shell` scope of its frame.
 */
@Component({
  selector: 'app-shell-header',
  imports: [
    TranslocoPipe,
    MkTopBarComponent,
    MkBannerComponent,
    MkButtonComponent,
    MkConnectionStatusComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (updates.unrecoverable()) {
      <mk-banner
        tone="critical"
        role="alert"
        icon="circle-x"
        [title]="'shell.banner.unrecoverable' | transloco"
        data-testid="shell.unrecoverable"
      >
        <button mkBannerAction mk-button variant="ghost" type="button" (click)="updates.reload()">
          {{ 'shell.banner.reload' | transloco }}
        </button>
      </mk-banner>
    }
    <mk-top-bar
      [title]="title()"
      [backLink]="backLink()"
      [backLabel]="'shell.nav.back' | transloco"
    >
      <mk-connection-status mkTopBarStatus [status]="connection.status()" />
      <ng-content select="[mkTopBarActions]" ngProjectAs="[mkTopBarActions]" />
    </mk-top-bar>
  `,
})
export class ShellHeaderComponent {
  readonly title = input.required<string>()
  readonly backLink = input<string | readonly string[]>()

  protected readonly connection = inject(ConnectionStatusStore)
  protected readonly updates = inject(UpdateService)
}
