import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkButtonComponent } from '../../shared/ui/button/button.component'

/**
 * Placeholder sign-in page: the form arrives with the API (WP 0.6b). Says
 * so honestly and offers the only thing that works today.
 */
@Component({
  selector: 'app-login-page',
  imports: [RouterLink, TranslocoPipe, MkButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl font-semibold text-ink-1">{{ 'shell.login.title' | transloco }}</h1>
    <p class="mt-3 text-sm text-ink-2" data-testid="login.placeholder">
      {{ 'shell.login.body' | transloco }}
    </p>
    <a mk-button variant="secondary" routerLink="/trips" class="mt-6" data-testid="login.continue">
      {{ 'shell.login.continue' | transloco }}
    </a>
  `,
})
export default class LoginPage {}
