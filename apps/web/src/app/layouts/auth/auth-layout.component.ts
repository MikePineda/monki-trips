import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkPageComponent } from '../../shared/ui/layout/page.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { provideShellI18n } from '../shell/shell-i18n'

/**
 * The frame of the public pages (sign-in, invitations, legal): the product
 * name on top and one centred column. No navigation, no tab bar.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, TranslocoPipe, MkPageComponent, MkStackComponent, MkTextComponent],
  providers: [provideShellI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-page>
      <mk-stack gap="6">
        <p mk-text variant="body-strong" align="center" data-testid="shell.name">
          {{ 'app.name' | transloco }}
        </p>
        <main>
          <router-outlet />
        </main>
      </mk-stack>
    </mk-page>
  `,
})
export class AuthLayoutComponent {}
