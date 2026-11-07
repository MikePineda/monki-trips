import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterLink, RouterOutlet } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { ShellHeaderComponent } from './shell-header.component'
import { provideShellI18n } from './shell-i18n'

/**
 * The frame outside a trip: the trip list, the share inbox and settings.
 * Header with the product name, the connection indicator and a settings
 * link; the routed page below. No tab bar here: tabs belong to a trip.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, TranslocoPipe, ShellHeaderComponent, MkIconComponent],
  providers: [provideShellI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-shell-header [title]="'app.name' | transloco">
      <a
        routerLink="/settings"
        class="-mr-2 inline-flex size-10 items-center justify-center rounded-full text-ink-2"
        [attr.aria-label]="'shell.nav.settings' | transloco"
        data-testid="shell.nav.settings"
      >
        <mk-icon name="settings" />
      </a>
    </app-shell-header>
    <main class="mx-auto max-w-2xl px-4 py-6">
      <router-outlet />
    </main>
  `,
})
export class ShellComponent {}
