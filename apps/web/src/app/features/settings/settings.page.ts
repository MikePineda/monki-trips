import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { APP_LANGS, type AppLang } from '../../domain/locale'
import { LangStore } from '../../core/i18n/lang.store'
import { AppVersionStore } from '../../core/pwa/app-version.store'
import { InstallService } from '../../core/pwa/install.service'
import { ThemeStore, type ThemePreference } from '../../core/theme/theme.store'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { InstallInstructionsSheet } from './install-instructions.sheet'
import { provideSettingsI18n } from './settings-i18n'

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark']

/**
 * Settings: UI language (overrides the device pick), theme, the account
 * (features/account, rendered as this route's child so the features stay
 * independent), installing the app and the server build the device last
 * saw. Each choice applies at once and is remembered on the device.
 */
@Component({
  selector: 'app-settings-page',
  imports: [TranslocoPipe, MkButtonComponent, RouterOutlet],
  providers: [provideSettingsI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl font-semibold text-ink-1">{{ 'settings.title' | transloco }}</h1>

    <section class="mt-6">
      <h2 class="text-sm font-medium text-ink-2" id="settings-language">
        {{ 'settings.language.label' | transloco }}
      </h2>
      <div
        class="mt-2 inline-flex rounded-lg border border-line-strong p-0.5"
        role="radiogroup"
        aria-labelledby="settings-language"
      >
        @for (lang of langs; track lang) {
          <button
            type="button"
            role="radio"
            class="min-h-10 rounded-md px-3 text-sm aria-checked:bg-surface-2 aria-checked:font-medium aria-checked:text-ink-1 text-ink-2"
            [attr.aria-checked]="langStore.lang() === lang"
            [attr.lang]="lang"
            [attr.data-testid]="'settings.lang.' + lang"
            (click)="langStore.use(lang)"
          >
            {{ 'settings.language.' + lang | transloco }}
          </button>
        }
      </div>
    </section>

    <section class="mt-6">
      <h2 class="text-sm font-medium text-ink-2" id="settings-theme">
        {{ 'settings.theme.label' | transloco }}
      </h2>
      <div
        class="mt-2 inline-flex rounded-lg border border-line-strong p-0.5"
        role="radiogroup"
        aria-labelledby="settings-theme"
      >
        @for (theme of themes; track theme) {
          <button
            type="button"
            role="radio"
            class="min-h-10 rounded-md px-3 text-sm aria-checked:bg-surface-2 aria-checked:font-medium aria-checked:text-ink-1 text-ink-2"
            [attr.aria-checked]="themeStore.preference() === theme"
            [attr.data-testid]="'settings.theme.' + theme"
            (click)="themeStore.set(theme)"
          >
            {{ 'settings.theme.' + theme | transloco }}
          </button>
        }
      </div>
    </section>

    <!-- The account section (features/account) is this route's child. -->
    <router-outlet />

    <section class="mt-6">
      <h2 class="text-sm font-medium text-ink-2">{{ 'settings.install.label' | transloco }}</h2>
      <div
        class="mt-2 text-sm text-ink-1"
        data-testid="settings.install"
        [attr.data-mode]="install.mode()"
      >
        @switch (install.mode()) {
          @case ('installed') {
            <p>{{ 'settings.install.installed' | transloco }}</p>
          }
          @case ('unavailable') {
            <p class="text-ink-2">{{ 'settings.install.unavailable' | transloco }}</p>
          }
          @default {
            <button
              mk-button
              variant="secondary"
              type="button"
              data-testid="settings.install.action"
              (click)="installApp()"
            >
              {{ 'settings.install.action' | transloco }}
            </button>
          }
        }
      </div>
    </section>

    <section class="mt-6">
      <h2 class="text-sm font-medium text-ink-2">{{ 'settings.version.label' | transloco }}</h2>
      <p
        class="mt-2 flex items-center gap-3 text-sm tabular-nums text-ink-1"
        data-testid="settings.version"
      >
        @if (version.info(); as info) {
          <span>{{
            'settings.version.value' | transloco: { version: info.version, sha: info.sha }
          }}</span>
        } @else {
          <span class="text-ink-2">{{ 'settings.version.unknown' | transloco }}</span>
        }
        <button
          mk-button
          variant="ghost"
          type="button"
          data-testid="settings.version.refresh"
          (click)="version.refresh()"
        >
          {{ 'settings.version.refresh' | transloco }}
        </button>
      </p>
    </section>
  `,
})
export default class SettingsPage {
  protected readonly langStore = inject(LangStore)
  protected readonly themeStore = inject(ThemeStore)
  protected readonly install = inject(InstallService)
  protected readonly version = inject(AppVersionStore)
  private readonly sheets = inject(SheetService)

  protected readonly langs: readonly AppLang[] = APP_LANGS
  protected readonly themes = THEMES

  constructor() {
    void this.version.refresh()
  }

  protected async installApp(): Promise<void> {
    if (this.install.mode() === 'ios-instructions') {
      this.sheets.open(InstallInstructionsSheet)
      return
    }
    await this.install.prompt()
  }
}
