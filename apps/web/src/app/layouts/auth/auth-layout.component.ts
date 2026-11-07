import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { provideShellI18n } from '../shell/shell-i18n'

/**
 * The frame of the public pages (sign-in, invitations, legal): the product
 * name on top and one centred column. No navigation, no tab bar.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, TranslocoPipe],
  providers: [provideShellI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-10">
      <p class="text-center font-semibold text-ink-1" data-testid="shell.name">
        {{ 'app.name' | transloco }}
      </p>
      <main class="mt-10 flex-1">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AuthLayoutComponent {}
