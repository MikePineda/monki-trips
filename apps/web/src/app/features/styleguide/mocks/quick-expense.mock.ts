import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { formatMoney } from '../../../domain/money'
import { provideShellI18n } from '../../../layouts/shell/shell-i18n'
import { MkButtonComponent } from '../../../shared/ui/button/button.component'
import { MkChipComponent } from '../../../shared/ui/chip/chip.component'
import { MkConnectionStatusComponent } from '../../../shared/ui/connection-status/connection-status.component'
import { MkDeviceFrameComponent } from '../../../shared/ui/device-frame/device-frame.component'
import { MkKeypadComponent } from '../../../shared/ui/keypad/keypad.component'
import { MkPageComponent } from '../../../shared/ui/layout/page.component'
import { MkRowComponent } from '../../../shared/ui/layout/row.component'
import { MkStackComponent } from '../../../shared/ui/layout/stack.component'
import { MkSheetComponent } from '../../../shared/ui/sheet/sheet.component'
import { MkTabBarComponent } from '../../../shared/ui/tab-bar/tab-bar.component'
import { MkTextComponent } from '../../../shared/ui/text/text.component'
import { MkTopBarComponent } from '../../../shared/ui/top-bar/top-bar.component'
import { DEMO_TRIP } from '../demo-trip'
import { provideStyleguideI18n } from '../styleguide-i18n'
import { mockLocale } from './mock-locale'
import { mockTabs } from './mock-tabs'

const CATEGORIES = ['food', 'transport', 'stay', 'tickets'] as const

/**
 * The quick-expense sheet over a dimmed Money tab: the amount as the
 * display number in the currency of today's country, the base currency
 * below, one row of category chips, the keypad and the block "Save
 * expense". Three taps from the FAB.
 */
@Component({
  selector: 'app-mock-quick-expense',
  imports: [
    TranslocoPipe,
    MkDeviceFrameComponent,
    MkTopBarComponent,
    MkConnectionStatusComponent,
    MkPageComponent,
    MkStackComponent,
    MkRowComponent,
    MkTextComponent,
    MkSheetComponent,
    MkChipComponent,
    MkKeypadComponent,
    MkButtonComponent,
    MkTabBarComponent,
  ],
  providers: [provideStyleguideI18n(), provideShellI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-device-frame [sheet]="true">
      <mk-top-bar
        mkFrameTop
        [title]="trip.name"
        backLink="/styleguide"
        [backLabel]="'shell.nav.back' | transloco"
      >
        <mk-connection-status mkTopBarStatus [status]="{ state: 'syncing', count: 1 }" />
      </mk-top-bar>
      <mk-page [tabBar]="true">
        <h1 mk-text variant="title">{{ 'shell.trip.money.title' | transloco }}</h1>
      </mk-page>
      <mk-tab-bar
        mkFrameBottom
        placement="static"
        [tabs]="tabs()"
        [label]="'shell.tabs.label' | transloco"
      />

      <mk-sheet mkFrameSheet [title]="'styleguide.expense.title' | transloco">
        <mk-stack gap="2">
          <mk-stack gap="0">
            <p mk-text variant="display" data-testid="styleguide.expense.amount">{{ amount() }}</p>
            <p mk-text variant="caption" tone="ink-2">
              {{
                'styleguide.expense.base'
                  | transloco: { amount: base(), currency: trip.baseCurrency }
              }}
            </p>
          </mk-stack>
          <mk-row
            gap="1"
            [wrap]="true"
            [attr.aria-label]="'styleguide.expense.category' | transloco"
          >
            @for (category of categories; track category) {
              <mk-chip
                [selectable]="true"
                [selected]="selected() === category"
                (selectedChange)="selected.set(category)"
              >
                {{ 'styleguide.expense.' + category | transloco }}
              </mk-chip>
            }
          </mk-row>
          <mk-keypad [(value)]="digits" />
        </mk-stack>
        <button mkSheetFooter mk-button size="block" type="button">
          {{ 'styleguide.expense.save' | transloco }}
        </button>
      </mk-sheet>
    </mk-device-frame>
  `,
})
export class MockQuickExpenseComponent {
  protected readonly trip = DEMO_TRIP
  protected readonly categories = CATEGORIES
  protected readonly selected = signal<string>('food')
  protected readonly digits = signal<string>(DEMO_TRIP.expense.digits)

  private readonly i18n = mockLocale()
  private readonly transloco = inject(TranslocoService)

  protected readonly tabs = computed(() => mockTabs(this.i18n.tabLabels(), 'money'))
  protected readonly amount = computed(() => {
    const minor = Math.round(Number(this.digits() || '0') * 100)
    return formatMoney(minor, DEMO_TRIP.expense.currency, this.i18n.locale())
  })
  protected readonly base = computed(() =>
    formatMoney(DEMO_TRIP.expense.baseMinor, DEMO_TRIP.baseCurrency, this.i18n.locale())
  )

  constructor() {
    // Keeps the mock honest in both languages: the active language drives every label.
    this.transloco.getActiveLang()
  }
}
