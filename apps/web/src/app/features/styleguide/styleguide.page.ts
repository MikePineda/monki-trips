import { NgTemplateOutlet } from '@angular/common'
import { DOCUMENT, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { APP_LANGS, type AppLang } from '../../domain/locale'
import type { ConnectionStatus } from '../../domain/connection-status'
import { LangStore } from '../../core/i18n/lang.store'
import { ThemeStore, type ThemePreference } from '../../core/theme/theme.store'
import { provideShellI18n } from '../../layouts/shell/shell-i18n'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkChipComponent } from '../../shared/ui/chip/chip.component'
import { MkConnectionStatusComponent } from '../../shared/ui/connection-status/connection-status.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { ICON_NAMES } from '../../shared/ui/icon/icon-names'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { MkSkeletonComponent } from '../../shared/ui/skeleton/skeleton.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { COLOR_TOKENS } from './design-tokens'
import { SampleSheet } from './sample.sheet'

const CONNECTION_SAMPLES: readonly ConnectionStatus[] = [
  { state: 'failed', count: 1 },
  { state: 'offline', count: 2 },
  { state: 'syncing', count: 3 },
  { state: 'pending', count: 3 },
  { state: 'stale', count: 2 },
]

/**
 * The style guide: tokens, every ui-kit component in every state, both
 * themes side by side and a language switch, plus the slot where the
 * mascot lands in WP 0.7. Public and in production for phone review, but
 * `noindex`. Synthetic copy only.
 */
@Component({
  selector: 'app-styleguide-page',
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    MkButtonComponent,
    MkChipComponent,
    MkConnectionStatusComponent,
    MkEmptyStateComponent,
    MkFieldComponent,
    MkIconComponent,
    MkSkeletonComponent,
  ],
  providers: [provideShellI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-5xl px-4 py-6">
      <header class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-ink-1">
            {{ 'shell.styleguide.title' | transloco }}
          </h1>
          <p class="mt-1 text-sm text-ink-2">{{ 'shell.styleguide.intro' | transloco }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <div
            class="inline-flex rounded-lg border border-line-strong p-0.5"
            role="radiogroup"
            [attr.aria-label]="'shell.styleguide.languages' | transloco"
          >
            @for (lang of langs; track lang) {
              <button
                type="button"
                role="radio"
                class="min-h-10 rounded-md px-3 text-sm text-ink-2 aria-checked:bg-surface-2 aria-checked:font-medium aria-checked:text-ink-1"
                [attr.aria-checked]="langStore.lang() === lang"
                [attr.data-testid]="'styleguide.lang.' + lang"
                (click)="langStore.use(lang)"
              >
                {{ lang }}
              </button>
            }
          </div>
          <div
            class="inline-flex rounded-lg border border-line-strong p-0.5"
            role="radiogroup"
            [attr.aria-label]="'shell.styleguide.themes' | transloco"
          >
            @for (theme of themes; track theme) {
              <button
                type="button"
                role="radio"
                class="min-h-10 rounded-md px-3 text-sm text-ink-2 aria-checked:bg-surface-2 aria-checked:font-medium aria-checked:text-ink-1"
                [attr.aria-checked]="themeStore.preference() === theme"
                [attr.data-testid]="'styleguide.theme.' + theme"
                (click)="themeStore.set(theme)"
              >
                {{ theme }}
              </button>
            }
          </div>
        </div>
      </header>

      <h2 class="mt-8 font-medium text-ink-1">{{ 'shell.styleguide.tokens' | transloco }}</h2>
      <ul
        class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
        data-testid="styleguide.tokens"
      >
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

      <h2 class="mt-10 font-medium text-ink-1">{{ 'shell.styleguide.themes' | transloco }}</h2>
      <div class="mt-3 grid gap-4 md:grid-cols-2" data-testid="styleguide.themes">
        @for (theme of ['light', 'dark']; track theme) {
          <section
            [attr.data-theme]="theme"
            class="rounded-lg border border-line bg-surface-0 p-4 text-ink-1"
            [attr.data-testid]="'styleguide.theme-panel.' + theme"
          >
            <h3 class="text-sm font-medium text-ink-2">
              {{ 'shell.styleguide.' + theme | transloco }}
            </h3>
            <ng-container *ngTemplateOutlet="components" />
          </section>
        }
      </div>

      <h2 class="mt-10 font-medium text-ink-1">{{ 'shell.styleguide.mascot' | transloco }}</h2>
      <div
        class="mt-3 flex h-40 items-center justify-center rounded-lg border border-dashed border-line-strong text-sm text-ink-3"
        data-testid="styleguide.mascot"
      >
        {{ 'shell.styleguide.mascotBody' | transloco }}
      </div>
    </div>

    <ng-template #components>
      <h4 class="mt-4 text-xs font-medium uppercase tracking-wide text-ink-3">
        {{ 'shell.styleguide.buttons' | transloco }}
      </h4>
      <div class="mt-2 flex flex-wrap gap-2" data-testid="styleguide.buttons">
        <button mk-button type="button">{{ 'shell.styleguide.sample.primary' | transloco }}</button>
        <button mk-button variant="secondary" type="button">
          {{ 'shell.styleguide.sample.secondary' | transloco }}
        </button>
        <button mk-button variant="ghost" type="button">
          {{ 'shell.styleguide.sample.ghost' | transloco }}
        </button>
        <button mk-button type="button" [loading]="true">
          {{ 'shell.styleguide.sample.loading' | transloco }}
        </button>
        <button mk-button variant="secondary" type="button" [disabled]="true">
          {{ 'shell.styleguide.sample.disabled' | transloco }}
        </button>
      </div>

      <h4 class="mt-4 text-xs font-medium uppercase tracking-wide text-ink-3">
        {{ 'shell.styleguide.chips' | transloco }}
      </h4>
      <div class="mt-2 flex flex-wrap gap-2" data-testid="styleguide.chips">
        <mk-chip icon="plane">{{ 'shell.styleguide.sample.chipRoute' | transloco }}</mk-chip>
        <mk-chip [selectable]="true">{{ 'shell.styleguide.sample.chip' | transloco }}</mk-chip>
        <mk-chip [selectable]="true" [selected]="true">{{
          'shell.styleguide.sample.chipSelected' | transloco
        }}</mk-chip>
        <mk-chip [selectable]="true" [disabled]="true">{{
          'shell.styleguide.sample.disabled' | transloco
        }}</mk-chip>
      </div>

      <h4 class="mt-4 text-xs font-medium uppercase tracking-wide text-ink-3">
        {{ 'shell.styleguide.fields' | transloco }}
      </h4>
      <div class="mt-2 grid gap-3 sm:grid-cols-2" data-testid="styleguide.fields">
        <mk-field
          [label]="'shell.styleguide.sample.fieldLabel' | transloco"
          [hint]="'shell.styleguide.sample.fieldHint' | transloco"
          [required]="true"
        >
          <input type="text" />
        </mk-field>
        <mk-field
          [label]="'shell.styleguide.sample.fieldInvalid' | transloco"
          [error]="{ kind: 'minLength', min: 3 }"
        >
          <input type="text" value="ab" />
        </mk-field>
      </div>

      <h4 class="mt-4 text-xs font-medium uppercase tracking-wide text-ink-3">
        {{ 'shell.styleguide.connection' | transloco }}
      </h4>
      <ul class="mt-2 space-y-1" data-testid="styleguide.connection">
        @for (sample of connectionSamples; track sample.state) {
          <li><mk-connection-status [status]="sample" /></li>
        }
      </ul>

      <h4 class="mt-4 text-xs font-medium uppercase tracking-wide text-ink-3">
        {{ 'shell.styleguide.feedback' | transloco }}
      </h4>
      <div class="mt-2 flex flex-wrap gap-2" data-testid="styleguide.feedback">
        <button
          mk-button
          variant="secondary"
          type="button"
          data-testid="styleguide.open-sheet"
          (click)="openSheet()"
        >
          {{ 'shell.styleguide.openSheet' | transloco }}
        </button>
        <button
          mk-button
          variant="secondary"
          type="button"
          data-testid="styleguide.show-toast"
          (click)="showToast()"
        >
          {{ 'shell.styleguide.showToast' | transloco }}
        </button>
      </div>

      <h4 class="mt-4 text-xs font-medium uppercase tracking-wide text-ink-3">
        {{ 'shell.styleguide.skeleton' | transloco }}
      </h4>
      <mk-skeleton class="mt-2" [rows]="3" />

      <h4 class="mt-4 text-xs font-medium uppercase tracking-wide text-ink-3">
        {{ 'shell.styleguide.empty' | transloco }}
      </h4>
      <mk-empty-state
        class="mt-2 rounded-lg border border-line bg-surface-1"
        icon="inbox"
        [title]="'shell.styleguide.sample.emptyTitle' | transloco"
        [body]="'shell.styleguide.sample.emptyBody' | transloco"
      >
        <button mkEmptyAction mk-button variant="secondary" type="button">
          {{ 'shell.styleguide.sample.emptyAction' | transloco }}
        </button>
      </mk-empty-state>

      <h4 class="mt-4 text-xs font-medium uppercase tracking-wide text-ink-3">Icons</h4>
      <ul class="mt-2 flex flex-wrap gap-3 text-ink-2" data-testid="styleguide.icons">
        @for (icon of icons; track icon) {
          <li><mk-icon [name]="icon" [label]="icon" /></li>
        }
      </ul>
    </ng-template>
  `,
})
export default class StyleguidePage {
  protected readonly tokens = COLOR_TOKENS
  protected readonly icons = ICON_NAMES
  protected readonly langs: readonly AppLang[] = APP_LANGS
  protected readonly themes: readonly ThemePreference[] = ['system', 'light', 'dark']
  protected readonly connectionSamples = CONNECTION_SAMPLES
  protected readonly langStore = inject(LangStore)
  protected readonly themeStore = inject(ThemeStore)
  protected readonly undone = signal(false)

  private readonly sheets = inject(SheetService)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)
  private readonly document = inject(DOCUMENT)

  constructor() {
    this.noindex()
  }

  protected openSheet(): void {
    this.sheets.open(SampleSheet, {
      label: this.transloco.translate('shell.styleguide.sample.sheetTitle'),
    })
  }

  protected showToast(): void {
    this.toasts.showUndo(this.transloco.translate('shell.styleguide.toastMessage'), () =>
      this.toasts.show({ message: this.transloco.translate('shell.styleguide.undone') })
    )
  }

  /** The guide ships to production for phone review but never to search engines. */
  private noindex(): void {
    if (!this.document.head.querySelector('meta[name="robots"]')) {
      const meta = this.document.createElement('meta')
      meta.setAttribute('name', 'robots')
      meta.setAttribute('content', 'noindex')
      this.document.head.append(meta)
    }
  }
}
