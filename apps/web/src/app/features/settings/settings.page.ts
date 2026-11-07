import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { RouterOutlet } from '@angular/router'
import { TRANSLOCO_SCOPE, TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { APP_LANGS, type AppLang } from '../../domain/locale'
import { LangStore } from '../../core/i18n/lang.store'
import { AppVersionStore } from '../../core/pwa/app-version.store'
import { InstallService } from '../../core/pwa/install.service'
import { ThemeStore, type ThemePreference } from '../../core/theme/theme.store'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import {
  MkSegmentedComponent,
  type SegmentOption,
} from '../../shared/ui/segmented/segmented.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { InstallInstructionsSheet } from './install-instructions.sheet'
import { NotificationsSectionComponent } from './notifications-section.component'
import { provideSettingsI18n } from './settings-i18n'

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark']

/**
 * Settings: UI language (overrides the device pick), theme, the account
 * (features/account, rendered as this route's child so the features stay
 * independent), notifications on this device, installing the app and the
 * server build the device last saw. Each choice applies at once and is
 * remembered on the device.
 */
@Component({
  selector: 'app-settings-page',
  imports: [
    TranslocoPipe,
    MkButtonComponent,
    MkRowComponent,
    MkSectionComponent,
    MkStackComponent,
    MkSegmentedComponent,
    MkTextComponent,
    NotificationsSectionComponent,
    RouterOutlet,
  ],
  providers: [provideSettingsI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="2">
      <h1 mk-text variant="title">{{ 'settings.title' | transloco }}</h1>

      <mk-section [eyebrow]="'settings.language.label' | transloco">
        <mk-segmented
          [options]="langOptions()"
          [value]="langStore.lang()"
          (valueChange)="useLang($event)"
          [label]="'settings.language.label' | transloco"
          [optionLang]="true"
          testId="settings.lang"
        />
      </mk-section>

      <mk-section [eyebrow]="'settings.theme.label' | transloco">
        <mk-segmented
          [options]="themeOptions()"
          [value]="themeStore.preference()"
          (valueChange)="useTheme($event)"
          [label]="'settings.theme.label' | transloco"
          testId="settings.theme"
        />
      </mk-section>

      <!-- The account section (features/account) is this route's child. -->
      <router-outlet />

      <app-notifications-section />

      <mk-section [eyebrow]="'settings.install.label' | transloco">
        <div mk-text data-testid="settings.install" [attr.data-mode]="install.mode()">
          @switch (install.mode()) {
            @case ('installed') {
              <p mk-text>{{ 'settings.install.installed' | transloco }}</p>
            }
            @case ('unavailable') {
              <p mk-text tone="ink-2">{{ 'settings.install.unavailable' | transloco }}</p>
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
      </mk-section>

      <mk-section [eyebrow]="'settings.version.label' | transloco">
        <mk-row gap="2" data-testid="settings.version">
          @if (version.info(); as info) {
            <span mk-text variant="code">{{
              'settings.version.value' | transloco: { version: info.version, sha: info.sha }
            }}</span>
          } @else {
            <span mk-text tone="ink-2">{{ 'settings.version.unknown' | transloco }}</span>
          }
          <button
            mk-button
            variant="ghost"
            size="sm"
            type="button"
            data-testid="settings.version.refresh"
            (click)="version.refresh()"
          >
            {{ 'settings.version.refresh' | transloco }}
          </button>
        </mk-row>
      </mk-section>
    </mk-stack>
  `,
})
export default class SettingsPage {
  protected readonly langStore = inject(LangStore)
  protected readonly themeStore = inject(ThemeStore)
  protected readonly install = inject(InstallService)
  protected readonly version = inject(AppVersionStore)
  private readonly sheets = inject(SheetService)
  private readonly transloco = inject(TranslocoService)
  /** This component's own `settings` scope, so the service loads it like the pipe does. */
  private readonly scope = inject(TRANSLOCO_SCOPE)

  private readonly langLabels = toSignal(
    this.transloco.selectTranslate<string[]>(
      APP_LANGS.map((lang) => `language.${lang}`),
      {},
      this.scope
    ),
    { initialValue: [] as string[] }
  )
  private readonly themeLabels = toSignal(
    this.transloco.selectTranslate<string[]>(
      THEMES.map((theme) => `theme.${theme}`),
      {},
      this.scope
    ),
    { initialValue: [] as string[] }
  )

  protected readonly langOptions = computed<SegmentOption[]>(() =>
    APP_LANGS.map((lang, index) => ({ id: lang, label: this.langLabels()[index] ?? lang }))
  )
  protected readonly themeOptions = computed<SegmentOption[]>(() =>
    THEMES.map((theme, index) => ({ id: theme, label: this.themeLabels()[index] ?? theme }))
  )

  constructor() {
    void this.version.refresh()
  }

  protected useLang(lang: string | undefined): void {
    if (lang) {
      this.langStore.use(lang as AppLang)
    }
  }

  protected useTheme(theme: string | undefined): void {
    if (theme) {
      this.themeStore.set(theme as ThemePreference)
    }
  }

  protected async installApp(): Promise<void> {
    if (this.install.mode() === 'ios-instructions') {
      this.sheets.open(InstallInstructionsSheet)
      return
    }
    await this.install.prompt()
  }
}
