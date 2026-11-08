import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  inject,
  signal,
} from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { formatDayDate } from '../../domain/day-date'
import { APP_LANGS, type AppLang } from '../../domain/locale'
import { formatMoney } from '../../domain/money'
import type { ConnectionStatus } from '../../domain/connection-status'
import { LangStore } from '../../core/i18n/lang.store'
import { ThemeStore, type ThemePreference } from '../../core/theme/theme.store'
import { MkBannerComponent } from '../../shared/ui/banner/banner.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkChatMessageComponent } from '../../shared/ui/chat/chat-message.component'
import { MkChipComponent } from '../../shared/ui/chip/chip.component'
import { MkConnectionStatusComponent } from '../../shared/ui/connection-status/connection-status.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkFabComponent } from '../../shared/ui/fab/fab.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkIconButtonComponent } from '../../shared/ui/icon-button/icon-button.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { ICON_NAMES } from '../../shared/ui/icon/icon-names'
import { MkKeypadComponent } from '../../shared/ui/keypad/keypad.component'
import { MkPageComponent } from '../../shared/ui/layout/page.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkEventRowComponent } from '../../shared/ui/list/event-row.component'
import { MkListRowComponent } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MASCOT_STATES } from '../../shared/ui/mascot/mascot-sheet'
import { MkMascotComponent, type MascotSize } from '../../shared/ui/mascot/mascot.component'
import { MkProgressComponent } from '../../shared/ui/progress/progress.component'
import {
  MkProposalComponent,
  type ProposalChange,
  type ProposalStatus,
} from '../../shared/ui/proposal/proposal.component'
import { MkRouteChipComponent } from '../../shared/ui/route-chip/route-chip.component'
import {
  MkSegmentedComponent,
  type SegmentOption,
} from '../../shared/ui/segmented/segmented.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { MkShowCardComponent } from '../../shared/ui/show-card/show-card.component'
import { MkSkeletonComponent } from '../../shared/ui/skeleton/skeleton.component'
import { MkStampComponent } from '../../shared/ui/stamp/stamp.component'
import { MkStatRowComponent } from '../../shared/ui/stat-tile/stat-row.component'
import { MkStatTileComponent } from '../../shared/ui/stat-tile/stat-tile.component'
import { MkSwatchComponent } from '../../shared/ui/swatch/swatch.component'
import { MkTabBarComponent } from '../../shared/ui/tab-bar/tab-bar.component'
import { MkTextComponent, TEXT_VARIANTS } from '../../shared/ui/text/text.component'
import { MkTicketComponent } from '../../shared/ui/ticket/ticket.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { DEMO_TRIP } from './demo-trip'
import { STAMP_SHEET } from './stamp-sheet'
import { TOKEN_GROUPS } from './design-tokens'
import { MockItineraryDayComponent } from './mocks/itinerary-day.mock'
import { MockQuickExpenseComponent } from './mocks/quick-expense.mock'
import { MockTodayComponent } from './mocks/today.mock'
import { MockTripsComponent } from './mocks/trips.mock'
import { mockTabs } from './mocks/mock-tabs'
import { mockLocale, scopedLabels } from './mocks/mock-locale'
import { SampleSheet } from './sample.sheet'
import { provideStyleguideI18n } from './styleguide-i18n'
import { provideShellI18n } from '../../layouts/shell/shell-i18n'

const CONNECTION_SAMPLES: readonly ConnectionStatus[] = [
  { state: 'failed', count: 1 },
  { state: 'offline', count: 2 },
  { state: 'syncing', count: 3 },
  { state: 'pending', count: 3 },
  { state: 'stale', count: 2 },
]

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark']
const MASCOT_SIZES: readonly MascotSize[] = ['sm', 'md', 'lg']

/**
 * The style guide: the design system in code so the owner can approve it
 * from a phone before any product screen is built. Tokens with live
 * contrast ratios, the type scale, every ui-kit component in every state,
 * Kiko in six states at three sizes, the sample stamps and four mock
 * screens built with the real components. Public and in production, but
 * `noindex`. Synthetic data only; copy through Transloco only.
 */
@Component({
  selector: 'app-styleguide-page',
  imports: [
    TranslocoPipe,
    MkPageComponent,
    MkStackComponent,
    MkRowComponent,
    MkSectionComponent,
    MkTextComponent,
    MkSegmentedComponent,
    MkSwatchComponent,
    MkButtonComponent,
    MkIconButtonComponent,
    MkIconComponent,
    MkChipComponent,
    MkRouteChipComponent,
    MkFieldComponent,
    MkInputDirective,
    MkListComponent,
    MkListRowComponent,
    MkEventRowComponent,
    MkTicketComponent,
    MkStatRowComponent,
    MkStatTileComponent,
    MkBannerComponent,
    MkProgressComponent,
    MkTabBarComponent,
    MkFabComponent,
    MkConnectionStatusComponent,
    MkEmptyStateComponent,
    MkShowCardComponent,
    MkSkeletonComponent,
    MkKeypadComponent,
    MkMascotComponent,
    MkStampComponent,
    MkChatMessageComponent,
    MkProposalComponent,
    MockTodayComponent,
    MockTripsComponent,
    MockItineraryDayComponent,
    MockQuickExpenseComponent,
  ],
  providers: [provideStyleguideI18n(), provideShellI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-page>
      <mk-stack gap="3" role="main">
        <mk-stack gap="2">
          <h1 mk-text variant="title">{{ 'styleguide.title' | transloco }}</h1>
          <p mk-text tone="ink-2">{{ 'styleguide.intro' | transloco }}</p>
          <mk-row gap="1" [wrap]="true">
            <mk-segmented
              [options]="langOptions"
              [value]="langStore.lang()"
              (valueChange)="useLang($event)"
              [label]="'styleguide.languages' | transloco"
              [optionLang]="true"
              testId="styleguide.lang"
            />
            <mk-segmented
              [options]="themeOptions()"
              [value]="themeStore.preference()"
              (valueChange)="useTheme($event)"
              [label]="'styleguide.themes' | transloco"
              testId="styleguide.theme"
            />
          </mk-row>
        </mk-stack>

        <!-- Tokens -->
        <mk-section
          [title]="'styleguide.sections.tokens' | transloco"
          data-testid="styleguide.tokens"
        >
          <mk-stack gap="2">
            <p mk-text variant="caption" tone="ink-2">
              {{ 'styleguide.sections.tokensIntro' | transloco }}
            </p>
            @for (group of tokenGroups; track group.id) {
              <mk-stack gap="half">
                <p mk-text variant="eyebrow" tone="ink-3">
                  {{ 'styleguide.roles.' + group.id | transloco }}
                </p>
                <mk-row gap="2" align="start" [wrap]="true">
                  @for (token of group.tokens; track token.name) {
                    <mk-swatch [token]="token.name" [against]="token.against" />
                  }
                </mk-row>
              </mk-stack>
            }
          </mk-stack>
        </mk-section>

        <!-- Typography -->
        <mk-section
          [title]="'styleguide.sections.typography' | transloco"
          data-testid="styleguide.typography"
        >
          <mk-stack gap="2">
            @for (variant of textVariants; track variant) {
              <mk-stack gap="0">
                <p mk-text [variant]="variant" [attr.data-variant]="variant">
                  {{ sampleFor(variant) }}
                </p>
                <p mk-text variant="caption" tone="ink-3">
                  {{ 'styleguide.type.' + variant | transloco }}
                </p>
              </mk-stack>
            }
          </mk-stack>
        </mk-section>

        <!-- Components -->
        <mk-section
          [title]="'styleguide.sections.components' | transloco"
          data-testid="styleguide.components"
        >
          <mk-stack gap="3">
            <mk-section
              [eyebrow]="'styleguide.components.buttons' | transloco"
              data-testid="styleguide.buttons"
            >
              <mk-stack gap="1" align="start">
                <mk-row gap="1" [wrap]="true">
                  <button mk-button type="button">
                    {{ 'styleguide.sample.primary' | transloco }}
                  </button>
                  <button mk-button variant="secondary" type="button">
                    <mk-icon name="navigation" [size]="16" />
                    {{ 'styleguide.sample.secondary' | transloco }}
                  </button>
                  <button mk-button variant="ghost" type="button">
                    {{ 'styleguide.sample.ghost' | transloco }}
                  </button>
                  <button mk-button variant="destructive" type="button">
                    {{ 'styleguide.sample.destructive' | transloco }}
                  </button>
                </mk-row>
                <mk-row gap="1" [wrap]="true">
                  <button mk-button type="button" [loading]="true">
                    {{ 'styleguide.sample.loading' | transloco }}
                  </button>
                  <button mk-button variant="secondary" type="button" [disabled]="true">
                    {{ 'styleguide.sample.disabled' | transloco }}
                  </button>
                  <button mk-button variant="secondary" size="sm" type="button">
                    {{ 'styleguide.sample.small' | transloco }}
                  </button>
                </mk-row>
                <button mk-button size="block" type="button">
                  {{ 'styleguide.sample.block' | transloco }}
                </button>
              </mk-stack>
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.iconButtons' | transloco"
              data-testid="styleguide.icon-buttons"
            >
              <mk-row gap="1">
                <button
                  mk-icon-button
                  type="button"
                  [attr.aria-label]="'styleguide.today.copyAddress' | transloco"
                >
                  <mk-icon name="copy" />
                </button>
                <button
                  mk-icon-button
                  tone="accent"
                  type="button"
                  [attr.aria-label]="'styleguide.today.copyAddress' | transloco"
                >
                  <mk-icon name="copy" />
                </button>
                <button
                  mk-icon-button
                  size="sm"
                  type="button"
                  [attr.aria-label]="'ui.sheet.close' | transloco"
                >
                  <mk-icon name="x" [size]="16" />
                </button>
              </mk-row>
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.chips' | transloco"
              data-testid="styleguide.chips"
            >
              <mk-row gap="1" [wrap]="true">
                <mk-chip [selectable]="true">{{ 'styleguide.sample.chip' | transloco }}</mk-chip>
                <mk-chip [selectable]="true" [selected]="true">{{
                  'styleguide.sample.chipSelected' | transloco
                }}</mk-chip>
                <mk-chip [selectable]="true" [disabled]="true">{{
                  'styleguide.sample.disabled' | transloco
                }}</mk-chip>
                <mk-chip variant="status" tone="good" icon="circle-check">{{
                  'styleguide.sample.chipStatus' | transloco
                }}</mk-chip>
                <mk-chip variant="status" tone="warning" icon="alert-triangle">{{
                  'styleguide.sample.chipStatusWarning' | transloco
                }}</mk-chip>
                <mk-chip variant="tag" icon="ticket">{{
                  'styleguide.sample.chipTag' | transloco
                }}</mk-chip>
              </mk-row>
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.routeChips' | transloco"
              data-testid="styleguide.route-chips"
            >
              <mk-row gap="1" [wrap]="true">
                <mk-route-chip [stops]="trip.nextEvent.route" />
                <mk-route-chip [stops]="trip.stops" />
                <mk-route-chip [stops]="trip.nextEvent.route" size="display" />
              </mk-row>
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.fields' | transloco"
              data-testid="styleguide.fields"
            >
              <mk-stack gap="2">
                <mk-field
                  [label]="'styleguide.sample.fieldLabel' | transloco"
                  [hint]="'styleguide.sample.fieldHint' | transloco"
                  [required]="true"
                >
                  <input mkInput type="text" />
                </mk-field>
                <mk-field [label]="'styleguide.sample.fieldCode' | transloco">
                  <input mkInput variant="code" type="text" [value]="trip.nextEvent.reference" />
                </mk-field>
                <mk-field
                  [label]="'styleguide.sample.fieldInvalid' | transloco"
                  [error]="{ kind: 'minLength', minLength: 3 }"
                >
                  <input mkInput type="text" value="ab" />
                </mk-field>
              </mk-stack>
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.rows' | transloco"
              data-testid="styleguide.rows"
            >
              <mk-list>
                <mk-list-row
                  icon="file-text"
                  [title]="'styleguide.sample.rowTitle' | transloco"
                  [meta]="
                    trip.nextEvent.reference + ' · ' + ('styleguide.sample.rowMeta' | transloco)
                  "
                  [monoMeta]="true"
                  [status]="{
                    tone: 'good',
                    icon: 'circle-check',
                    label: 'styleguide.sample.rowStatus' | transloco,
                  }"
                />
                <mk-list-row
                  icon="settings"
                  [title]="'styleguide.sample.rowLink' | transloco"
                  [link]="['/styleguide']"
                />
                <mk-list-row
                  icon="utensils"
                  [title]="'styleguide.sample.rowValue' | transloco"
                  [value]="lunch()"
                  [chevron]="true"
                />
              </mk-list>
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.eventRows' | transloco"
              data-testid="styleguide.event-rows"
            >
              <mk-list>
                <mk-event-row
                  [time]="trip.nextEvent.time"
                  [zone]="trip.nextEvent.zone"
                  icon="train-front"
                  [title]="'styleguide.sample.eventTitle' | transloco"
                  [meta]="'styleguide.sample.eventMeta' | transloco"
                >
                  <button mkRowAction mk-button variant="ghost" size="sm" type="button">
                    <mk-icon name="navigation" [size]="16" />
                    {{ 'styleguide.today.directions' | transloco }}
                  </button>
                </mk-event-row>
                <mk-event-row
                  [time]="'styleguide.sample.allDay' | transloco"
                  icon="bed-double"
                  [title]="'styleguide.sample.lodging' | transloco"
                  [meta]="'styleguide.sample.lodgingMeta' | transloco"
                />
              </mk-list>
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.ticket' | transloco"
              data-testid="styleguide.ticket"
            >
              <mk-ticket
                [title]="trip.nextEvent.title"
                [time]="trip.nextEvent.time"
                [zone]="trip.nextEvent.zone"
                [countdown]="
                  'styleguide.today.countdown'
                    | transloco
                      : {
                          hours: trip.nextEvent.countdown.hours,
                          minutes: trip.nextEvent.countdown.minutes,
                        }
                "
                [leaveAt]="trip.nextEvent.leaveAt"
                [route]="trip.nextEvent.route"
                [reference]="trip.nextEvent.reference"
              >
                <button mkTicketAction mk-button variant="secondary" size="sm" type="button">
                  <mk-icon name="navigation" [size]="16" />
                  {{ 'styleguide.today.directions' | transloco }}
                </button>
              </mk-ticket>
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.segmented' | transloco"
              data-testid="styleguide.segmented"
            >
              <mk-segmented
                role="tablist"
                [options]="viewOptions()"
                [(value)]="view"
                [label]="'styleguide.components.segmented' | transloco"
              />
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.stats' | transloco"
              data-testid="styleguide.stats"
            >
              <mk-stat-row>
                <mk-stat-tile
                  [eyebrow]="'styleguide.sample.statLeft' | transloco"
                  [value]="leftToday()"
                  [sub]="leftTodayBase()"
                />
                <mk-stat-tile
                  [eyebrow]="'styleguide.sample.statSpent' | transloco"
                  [value]="yesterday()"
                  [sub]="'styleguide.sample.statSpentSub' | transloco"
                />
                <mk-stat-tile
                  [eyebrow]="'styleguide.sample.statPending' | transloco"
                  [value]="'1'"
                />
              </mk-stat-row>
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.banners' | transloco"
              data-testid="styleguide.banners"
            >
              <mk-stack gap="1">
                <mk-banner
                  tone="print"
                  icon="printer"
                  [title]="'styleguide.sample.bannerPrint' | transloco"
                  [body]="'styleguide.sample.bannerPrintBody' | transloco"
                >
                  <button mkBannerAction mk-button variant="ghost" size="sm" type="button">
                    {{ 'styleguide.sample.bannerPrinted' | transloco }}
                  </button>
                </mk-banner>
                <mk-banner
                  tone="saved"
                  icon="wifi-off"
                  [title]="'styleguide.sample.bannerSaved' | transloco"
                  [body]="'styleguide.sample.bannerSavedBody' | transloco"
                />
                <mk-banner
                  tone="critical"
                  role="alert"
                  icon="circle-x"
                  [title]="'styleguide.sample.bannerCritical' | transloco"
                >
                  <button mkBannerAction mk-button variant="ghost" size="sm" type="button">
                    {{ 'styleguide.sample.bannerCriticalAction' | transloco }}
                  </button>
                </mk-banner>
              </mk-stack>
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.progress' | transloco"
              data-testid="styleguide.progress"
            >
              <mk-stack gap="2">
                <mk-progress
                  [label]="'styleguide.sample.progressDocs' | transloco"
                  [value]="12"
                  [max]="18"
                />
                <mk-progress
                  variant="steps"
                  [label]="'styleguide.sample.progressReady' | transloco"
                  [value]="5"
                  [max]="7"
                />
              </mk-stack>
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.feedback' | transloco"
              data-testid="styleguide.feedback"
            >
              <mk-row gap="1" [wrap]="true">
                <button
                  mk-button
                  variant="secondary"
                  type="button"
                  data-testid="styleguide.open-sheet"
                  (click)="openSheet()"
                >
                  {{ 'styleguide.sample.openSheet' | transloco }}
                </button>
                <button
                  mk-button
                  variant="secondary"
                  type="button"
                  data-testid="styleguide.show-toast"
                  (click)="showToast()"
                >
                  {{ 'styleguide.sample.showToast' | transloco }}
                </button>
                <button
                  mk-button
                  variant="secondary"
                  type="button"
                  data-testid="styleguide.show-card"
                  (click)="cardShown.set(true)"
                >
                  {{ 'styleguide.sample.showCard' | transloco }}
                </button>
              </mk-row>
              @if (cardShown()) {
                <mk-show-card
                  lang="eo"
                  [phrase]="'styleguide.sample.cardPhrase' | transloco"
                  [romanization]="'styleguide.sample.cardRomanization' | transloco"
                  [prompt]="'styleguide.sample.cardPrompt' | transloco"
                  [screenKeptOn]="true"
                  (closed)="cardShown.set(false)"
                />
              }
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.tabBar' | transloco"
              data-testid="styleguide.tab-bar"
            >
              <mk-tab-bar
                placement="static"
                [tabs]="tabs()"
                [label]="'shell.tabs.label' | transloco"
              />
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.fab' | transloco"
              data-testid="styleguide.fab"
            >
              <button mk-fab placement="static" type="button">
                <mk-icon name="plus" />
                {{ 'styleguide.sample.fab' | transloco }}
              </button>
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.connection' | transloco"
              data-testid="styleguide.connection"
            >
              <mk-stack gap="1" align="start">
                @for (sample of connectionSamples; track sample.state) {
                  <mk-connection-status [status]="sample" />
                }
              </mk-stack>
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.empty' | transloco"
              data-testid="styleguide.empty"
            >
              <mk-stack gap="2">
                <mk-empty-state
                  mascot="excited"
                  [title]="'styleguide.sample.emptyTitle' | transloco"
                  [body]="'styleguide.sample.emptyBody' | transloco"
                >
                  <button mkEmptyAction mk-button type="button">
                    {{ 'styleguide.sample.emptyAction' | transloco }}
                  </button>
                </mk-empty-state>
                <mk-empty-state
                  icon="inbox"
                  [title]="'styleguide.sample.emptyIconTitle' | transloco"
                  [body]="'styleguide.sample.emptyIconBody' | transloco"
                />
                <mk-empty-state
                  layout="compact"
                  mascot="thinking"
                  [title]="'styleguide.sample.emptyDayTitle' | transloco"
                  [body]="'styleguide.sample.emptyDayBody' | transloco"
                >
                  <button mkEmptyAction mk-button variant="secondary" size="sm" type="button">
                    {{ 'styleguide.sample.emptyDayAction' | transloco }}
                  </button>
                </mk-empty-state>
              </mk-stack>
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.skeleton' | transloco"
              data-testid="styleguide.skeleton"
            >
              <mk-skeleton [rows]="3" />
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.keypad' | transloco"
              data-testid="styleguide.keypad"
            >
              <mk-stack gap="1">
                <p mk-text variant="display">{{ keypadAmount() }}</p>
                <mk-keypad [(value)]="keypadDigits" />
              </mk-stack>
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.assistant' | transloco"
              data-testid="styleguide.assistant"
            >
              <mk-list>
                <mk-chat-message author="member" [name]="'styleguide.sample.chatYou' | transloco">
                  <p mk-text [preserveLines]="true">
                    {{ 'styleguide.sample.chatQuestion' | transloco }}
                  </p>
                </mk-chat-message>
                <mk-chat-message
                  author="assistant"
                  [name]="'styleguide.sample.chatKiko' | transloco"
                >
                  <p mk-text [preserveLines]="true">
                    {{ 'styleguide.sample.chatAnswer' | transloco }}
                  </p>
                  <mk-proposal
                    icon="calendar"
                    [kind]="'styleguide.sample.proposalKind' | transloco"
                    [title]="'styleguide.sample.proposalTitle' | transloco"
                    [changes]="proposalChanges()"
                  >
                    <mk-row mkProposalActions gap="1">
                      <button mk-button size="sm" type="button">
                        <mk-icon name="check" [size]="16" />
                        {{ 'styleguide.sample.proposalAccept' | transloco }}
                      </button>
                      <button mk-button variant="secondary" size="sm" type="button">
                        <mk-icon name="x" [size]="16" />
                        {{ 'styleguide.sample.proposalReject' | transloco }}
                      </button>
                    </mk-row>
                  </mk-proposal>
                  <mk-proposal
                    icon="wallet"
                    [kind]="'styleguide.sample.proposalExpenseKind' | transloco"
                    [title]="'styleguide.sample.proposalExpenseTitle' | transloco"
                    [changes]="expenseChanges()"
                    [status]="acceptedStatus()"
                  />
                </mk-chat-message>
              </mk-list>
            </mk-section>

            <mk-section
              [eyebrow]="'styleguide.components.icons' | transloco"
              data-testid="styleguide.icons"
            >
              <mk-row gap="2" [wrap]="true">
                @for (icon of icons; track icon) {
                  <mk-icon [name]="icon" [label]="icon" />
                }
              </mk-row>
            </mk-section>
          </mk-stack>
        </mk-section>

        <!-- Mascot -->
        <mk-section
          [title]="'styleguide.sections.mascot' | transloco"
          data-testid="styleguide.mascot"
        >
          <mk-stack gap="2">
            <p mk-text variant="caption" tone="ink-2">
              {{ 'styleguide.sections.mascotIntro' | transloco }}
            </p>
            <mk-chip [selectable]="true" [(selected)]="still" data-testid="styleguide.mascot.still">
              {{ 'styleguide.motion.still' | transloco }}
            </mk-chip>
            @for (state of mascotStates; track state) {
              <mk-row
                gap="2"
                align="end"
                [wrap]="true"
                [attr.data-testid]="'styleguide.mascot.' + state"
              >
                @for (size of mascotSizes; track size) {
                  <mk-mascot
                    [state]="state"
                    [size]="size"
                    [motion]="motion()"
                    [label]="'styleguide.mascotStates.' + state | transloco"
                  />
                }
                <p mk-text variant="eyebrow" tone="ink-3">
                  {{ 'styleguide.mascotStates.' + state | transloco }}
                </p>
              </mk-row>
            }
          </mk-stack>
        </mk-section>

        <!-- Stamps -->
        <mk-section
          [title]="'styleguide.sections.stamps' | transloco"
          data-testid="styleguide.stamps"
        >
          <mk-stack gap="2">
            <p mk-text variant="caption" tone="ink-2">
              {{ 'styleguide.sections.stampsIntro' | transloco }}
            </p>
            <mk-row gap="2" [wrap]="true">
              @for (stamp of trip.stamps; track stamp.code) {
                <mk-stamp [code]="stamp.code" [name]="stamp.name" [date]="stampDate(stamp.date)" />
              }
              <mk-stamp code="ZZ" [name]="trip.city" [date]="stampDate(trip.startDate)" />
              <mk-stamp code="XB" [name]="trip.stamps[1].name" [reached]="false" />
            </mk-row>
            <h3 mk-text variant="heading">{{ 'styleguide.sections.stampSheet' | transloco }}</h3>
            <p mk-text variant="caption" tone="ink-2">
              {{ 'styleguide.sections.stampSheetIntro' | transloco }}
            </p>
            <mk-row gap="2" [wrap]="true" data-testid="styleguide.stampSheet">
              @for (stamp of stampSheet; track stamp.name) {
                <mk-stamp
                  [code]="stamp.code"
                  [name]="stamp.name"
                  [isoDate]="stamp.date"
                  [arrivedBy]="stamp.arrivedBy"
                />
              }
            </mk-row>
          </mk-stack>
        </mk-section>

        <!-- Screens -->
        <mk-section
          [title]="'styleguide.sections.screens' | transloco"
          data-testid="styleguide.screens"
        >
          <mk-stack gap="3">
            <p mk-text variant="caption" tone="ink-2">
              {{ 'styleguide.sections.screensIntro' | transloco }}
            </p>
            <mk-stack gap="1" data-testid="styleguide.mock.today">
              <p mk-text variant="eyebrow" tone="ink-3">
                {{ 'styleguide.screens.today' | transloco }}
              </p>
              <app-mock-today [motion]="motion()" />
            </mk-stack>
            <mk-stack gap="1" data-testid="styleguide.mock.trips">
              <p mk-text variant="eyebrow" tone="ink-3">
                {{ 'styleguide.screens.trips' | transloco }}
              </p>
              <app-mock-trips />
            </mk-stack>
            <mk-stack gap="1" data-testid="styleguide.mock.day">
              <p mk-text variant="eyebrow" tone="ink-3">
                {{ 'styleguide.screens.day' | transloco }}
              </p>
              <app-mock-itinerary-day />
            </mk-stack>
            <mk-stack gap="1" data-testid="styleguide.mock.expense">
              <p mk-text variant="eyebrow" tone="ink-3">
                {{ 'styleguide.screens.expense' | transloco }}
              </p>
              <app-mock-quick-expense />
            </mk-stack>
          </mk-stack>
        </mk-section>
      </mk-stack>
    </mk-page>
  `,
})
export default class StyleguidePage {
  protected readonly trip = DEMO_TRIP
  protected readonly stampSheet = STAMP_SHEET
  protected readonly tokenGroups = TOKEN_GROUPS
  protected readonly textVariants = TEXT_VARIANTS
  protected readonly icons = ICON_NAMES
  protected readonly mascotStates = MASCOT_STATES
  protected readonly mascotSizes = MASCOT_SIZES
  protected readonly connectionSamples = CONNECTION_SAMPLES
  protected readonly langStore = inject(LangStore)
  protected readonly themeStore = inject(ThemeStore)
  protected readonly still = signal(false)
  protected readonly view = signal('days')
  protected readonly cardShown = signal(false)
  protected readonly keypadDigits = signal(DEMO_TRIP.expense.digits)

  protected readonly langOptions: readonly SegmentOption[] = APP_LANGS.map((lang: AppLang) => ({
    id: lang,
    label: lang.toUpperCase(),
  }))

  private readonly sheets = inject(SheetService)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)
  private readonly document = inject(DOCUMENT)
  private readonly i18n = mockLocale()

  private readonly themeLabels = scopedLabels(
    'styleguide',
    THEMES.map((theme) => `theme.${theme}`)
  )
  private readonly viewLabels = scopedLabels('styleguide', [
    'sample.segmentDays',
    'sample.segmentStays',
  ])

  protected readonly motion = computed(() => (this.still() ? 'still' : 'auto'))
  protected readonly themeOptions = computed<SegmentOption[]>(() =>
    THEMES.map((theme, index) => ({ id: theme, label: this.themeLabels()[index] ?? theme }))
  )
  protected readonly viewOptions = computed<SegmentOption[]>(() => [
    { id: 'days', label: this.viewLabels()[0] ?? '' },
    { id: 'stays', label: this.viewLabels()[1] ?? '' },
  ])
  protected readonly tabs = computed(() => mockTabs(this.i18n.tabLabels(), 'today'))
  protected readonly leftToday = computed(() =>
    formatMoney(DEMO_TRIP.money.leftTodayMinor, DEMO_TRIP.localCurrency, this.i18n.locale())
  )
  protected readonly leftTodayBase = computed(() =>
    formatMoney(DEMO_TRIP.money.leftTodayBaseMinor, DEMO_TRIP.baseCurrency, this.i18n.locale())
  )
  protected readonly yesterday = computed(() =>
    formatMoney(DEMO_TRIP.money.yesterdayOverMinor, DEMO_TRIP.localCurrency, this.i18n.locale())
  )
  protected readonly lunch = computed(() =>
    formatMoney(1800, DEMO_TRIP.localCurrency, this.i18n.locale())
  )
  private readonly proposalLabels = scopedLabels('styleguide', [
    'sample.proposalStarts',
    'sample.proposalNight',
    'sample.proposalNightNext',
    'sample.proposalNoBed',
    'sample.proposalLoses',
    'sample.proposalGains',
    'sample.proposalAmount',
    'sample.proposalBase',
    'sample.proposalAccepted',
  ])
  /** A move that shifts a stay by a night: one night loses its bed, the next gains one. */
  protected readonly proposalChanges = computed<ProposalChange[]>(() => {
    const [starts, night, nightNext, noBed, loses, gains] = this.proposalLabels()
    return [
      { label: starts ?? '', before: 'Wed 09:00', after: 'Thu 09:00', mono: true },
      {
        label: night ?? '',
        before: DEMO_TRIP.tonight.name,
        after: noBed ?? '',
        flag: { tone: 'serious', icon: 'alert-triangle', label: loses ?? '' },
      },
      {
        label: nightNext ?? '',
        before: noBed ?? '',
        after: DEMO_TRIP.tonight.name,
        flag: { tone: 'good', icon: 'bed', label: gains ?? '' },
      },
    ]
  })
  protected readonly expenseChanges = computed<ProposalChange[]>(() => {
    const labels = this.proposalLabels()
    return [
      { label: labels[6] ?? '', after: formatMoney(35_000, 'THB', this.i18n.locale()), mono: true },
      { label: labels[7] ?? '', after: formatMoney(1_556, 'AUD', this.i18n.locale()), mono: true },
    ]
  })
  protected readonly acceptedStatus = computed<ProposalStatus>(() => ({
    tone: 'good',
    icon: 'circle-check',
    label: this.proposalLabels()[8] ?? '',
  }))
  protected readonly keypadAmount = computed(() =>
    formatMoney(
      Math.round(Number(this.keypadDigits() || '0') * 100),
      DEMO_TRIP.expense.currency,
      this.i18n.locale()
    )
  )

  constructor() {
    this.noindex()
  }

  protected sampleFor(variant: string): string {
    const samples: Record<string, string> = {
      'display': this.leftToday(),
      'title': `${DEMO_TRIP.day} / ${DEMO_TRIP.totalDays}`,
      'heading': DEMO_TRIP.nextEvent.title,
      'body': DEMO_TRIP.tonight.address,
      'body-strong': `${DEMO_TRIP.nextEvent.leaveAt}`,
      'label': DEMO_TRIP.tonight.name,
      'caption': DEMO_TRIP.city,
      'code-display': `${DEMO_TRIP.nextEvent.route[0]} → ${DEMO_TRIP.nextEvent.route[1]}`,
      'code': `${DEMO_TRIP.nextEvent.time} ${DEMO_TRIP.nextEvent.zone}`,
      'code-label': DEMO_TRIP.nextEvent.reference,
      'eyebrow': DEMO_TRIP.nextEvent.zone,
    }
    return samples[variant] ?? variant
  }

  protected stampDate(isoDate: string): string {
    return formatDayDate(isoDate, this.i18n.locale(), false)
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

  protected openSheet(): void {
    this.sheets.open(SampleSheet, {
      label: this.transloco.translate('styleguide.sample.sheetTitle'),
    })
  }

  protected showToast(): void {
    this.toasts.showUndo(this.transloco.translate('styleguide.sample.toastMessage'), () =>
      this.toasts.show({ message: this.transloco.translate('styleguide.sample.undone') })
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
