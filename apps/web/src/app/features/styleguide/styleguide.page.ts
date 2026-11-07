import { ChangeDetectionStrategy, Component } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { COLOR_TOKENS } from './design-tokens'

/**
 * Placeholder style guide: every colour token as a swatch, in whichever
 * theme is active. The real guide (type, components, mascot) comes with the
 * design system.
 */
@Component({
  selector: 'app-styleguide-page',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl font-semibold text-ink-1">{{ 'shell.styleguide.title' | transloco }}</h1>
    <p class="mt-2 text-sm text-ink-2">{{ 'shell.styleguide.intro' | transloco }}</p>
    <h2 class="mt-6 font-medium text-ink-1">{{ 'shell.styleguide.tokens' | transloco }}</h2>
    <ul class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="styleguide.tokens">
      @for (token of tokens; track token) {
        <li class="flex items-center gap-3" [attr.data-token]="token">
          <span
            class="size-8 shrink-0 rounded border border-line-strong"
            [style.background-color]="'var(--' + token + ')'"
          ></span>
          <code class="text-xs text-ink-2">--{{ token }}</code>
        </li>
      }
    </ul>
  `,
})
export default class StyleguidePage {
  protected readonly tokens = COLOR_TOKENS
}
