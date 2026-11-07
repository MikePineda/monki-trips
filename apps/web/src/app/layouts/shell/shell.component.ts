import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { provideShellI18n } from './shell-i18n'

/**
 * The app frame: header with the product name and the main navigation, and
 * the routed page below. Placeholder chrome until the design system lands;
 * colours come from the tokens in src/styles.css only.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe],
  providers: [provideShellI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="border-b border-line bg-surface-1">
      <div class="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
        <span class="font-semibold text-ink-1" data-testid="shell.name">{{
          'app.name' | transloco
        }}</span>
        <nav [attr.aria-label]="'shell.nav.label' | transloco" class="flex gap-4 text-sm">
          <a
            routerLink="/trips"
            routerLinkActive="text-accent"
            class="text-ink-2 hover:text-ink-1"
            data-testid="shell.nav.trips"
            >{{ 'shell.nav.trips' | transloco }}</a
          >
          <a
            routerLink="/styleguide"
            routerLinkActive="text-accent"
            class="text-ink-2 hover:text-ink-1"
            data-testid="shell.nav.styleguide"
            >{{ 'shell.nav.styleguide' | transloco }}</a
          >
        </nav>
      </div>
    </header>
    <main class="mx-auto max-w-2xl px-4 py-6">
      <router-outlet />
    </main>
  `,
})
export class ShellComponent {}
