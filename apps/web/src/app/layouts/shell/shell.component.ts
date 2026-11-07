import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterLink, RouterOutlet } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkIconButtonComponent } from '../../shared/ui/icon-button/icon-button.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkPageComponent } from '../../shared/ui/layout/page.component'
import { ShellHeaderComponent } from './shell-header.component'
import { provideShellI18n } from './shell-i18n'

/**
 * The frame outside a trip: the trip list, the share inbox and settings.
 * Header with the product name, the connection indicator and a settings
 * link; the routed page below. No tab bar here: tabs belong to a trip.
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    TranslocoPipe,
    ShellHeaderComponent,
    MkIconComponent,
    MkIconButtonComponent,
    MkPageComponent,
  ],
  providers: [provideShellI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-shell-header [title]="'app.name' | transloco">
      <a
        mkTopBarActions
        mk-icon-button
        routerLink="/settings"
        [attr.aria-label]="'shell.nav.settings' | transloco"
        data-testid="shell.nav.settings"
      >
        <mk-icon name="settings" />
      </a>
    </app-shell-header>
    <mk-page>
      <router-outlet />
    </mk-page>
  `,
})
export class ShellComponent {}
