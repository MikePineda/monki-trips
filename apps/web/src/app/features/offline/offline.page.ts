import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import type { ReadinessCheck, ReadinessCheckKey } from '@monkitrips/shared'
import { intlLocale } from '../../core/i18n/intl-locale'
import { CLOCK } from '../../core/offline/clock'
import { ConnectionStatusStore } from '../../core/offline/connection-status.store'
import { TIME_ZONE } from '../../core/offline/time-zone'
import { AppVersionStore } from '../../core/pwa/app-version.store'
import { countKey } from '../../domain/count-key'
import { formatDayDate } from '../../domain/day-date'
import { localToday } from '../../domain/local-today'
import { clockTimeIn, relativeTime } from '../../domain/relative-time'
import { MkBannerComponent } from '../../shared/ui/banner/banner.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkConnectionStatusComponent } from '../../shared/ui/connection-status/connection-status.component'
import type { IconName } from '../../shared/ui/icon/icon-names'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent, type RowStatus } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkProgressComponent } from '../../shared/ui/progress/progress.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { MkSkeletonComponent } from '../../shared/ui/skeleton/skeleton.component'
import { MkStepsComponent } from '../../shared/ui/steps/steps.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { OfflineInstallSheet } from './install-sheet'
import { provideOfflineI18n } from './offline-i18n'
import { ReadyToFlyStore, type DownloadOutcome } from './ready-to-fly.store'

const CHECK_ICONS: Record<ReadinessCheckKey, IconName> = {
  version: 'refresh-cw',
  snapshot: 'clock',
  documents: 'file-text',
  assets: 'languages',
  storage: 'hard-drive',
  outbox: 'inbox',
  installed: 'smartphone',
}

interface CheckRow {
  key: ReadinessCheckKey
  icon: IconName
  ok: boolean
  /** Catalogue key and parameters of the line under the title. */
  detail: { key: string; params: Record<string, unknown> }
  status: { tone: RowStatus['tone']; icon: IconName; key: string }
  /** Catalogue key of the fix button, when the check is not ready. */
  fix: string | null
}

/**
 * "Ready to fly" (`more/offline`): the seven checks of `offline_readiness`
 * read live from this device, each with the action that fixes it;
 * "Download everything" with its progress; the airplane-mode rehearsal
 * with the date of the last cold start without network; the connection
 * line; the install sheet on iOS.
 */
@Component({
  selector: 'app-offline-page',
  imports: [
    TranslocoPipe,
    MkBannerComponent,
    MkButtonComponent,
    MkConnectionStatusComponent,
    MkListComponent,
    MkListRowComponent,
    MkProgressComponent,
    MkSectionComponent,
    MkSkeletonComponent,
    MkStackComponent,
    MkStepsComponent,
    MkTextComponent,
  ],
  providers: [provideOfflineI18n(), ReadyToFlyStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="2">
      <h1 mk-text variant="title">{{ 'offline.title' | transloco }}</h1>

      <mk-section [eyebrow]="'offline.status.label' | transloco">
        <div mk-text data-testid="offline.status">
          @if (connection.status().state === 'synced') {
            {{ 'offline.status.synced' | transloco }}
          } @else {
            <mk-connection-status [status]="connection.status()" />
          }
        </div>
      </mk-section>

      <mk-section [title]="'offline.ready.title' | transloco" data-testid="offline.ready">
        @if (store.readiness(); as readiness) {
          <mk-stack gap="1">
            <p
              mk-text
              variant="body-strong"
              data-testid="offline.ready.summary"
              [attr.data-ready]="readiness.ready"
            >
              @if (readiness.ready) {
                {{ 'offline.ready.allGood' | transloco }}
              } @else {
                {{ notReadyKey() | transloco: { count: toFix() } }}
              }
            </p>
            <mk-list>
              @for (row of rows(); track row.key) {
                <mk-list-row
                  [icon]="row.icon"
                  [title]="'offline.checks.' + row.key + '.title' | transloco"
                  [meta]="row.detail.key | transloco: row.detail.params"
                  [status]="{
                    tone: row.status.tone,
                    icon: row.status.icon,
                    label: (row.status.key | transloco),
                  }"
                  [testId]="'offline.check.' + row.key"
                >
                  <ng-container ngProjectAs="[mkRowTrailing]">
                    @if (row.fix; as fix) {
                      <button
                        mk-button
                        variant="secondary"
                        size="sm"
                        type="button"
                        [disabled]="store.busy()"
                        [attr.data-testid]="'offline.fix.' + row.key"
                        (click)="fixCheck(row.key)"
                      >
                        {{ fix | transloco }}
                      </button>
                    }
                  </ng-container>
                </mk-list-row>
              }
            </mk-list>
          </mk-stack>
        } @else {
          <mk-skeleton mascot="thinking" [rows]="7" />
        }
      </mk-section>

      <mk-section data-testid="offline.download">
        <mk-stack gap="1">
          @if (store.ios && !store.installed()) {
            <p mk-text variant="caption" tone="ink-2">
              {{ 'offline.download.iosOnly' | transloco }}
            </p>
          }
          @if (store.progress(); as progress) {
            <mk-progress
              [label]="'offline.download.' + progress.step | transloco"
              [value]="progress.done"
              [max]="progress.total"
              data-testid="offline.download.progress"
            />
          }
          <button
            mk-button
            variant="primary"
            size="block"
            type="button"
            [loading]="store.busy()"
            data-testid="offline.download.action"
            (click)="downloadEverything()"
          >
            {{ 'offline.download.action' | transloco }}
          </button>
          @if (outcome(); as outcome) {
            <p
              mk-text
              variant="caption"
              tone="ink-2"
              role="status"
              data-testid="offline.download.outcome"
            >
              {{ outcome.key | transloco: { count: outcome.count } }}
            </p>
          }
        </mk-stack>
      </mk-section>

      <mk-section [title]="'offline.airplane.title' | transloco" data-testid="offline.airplane">
        <mk-stack gap="1">
          <mk-steps
            [steps]="[
              'offline.airplane.step1' | transloco,
              'offline.airplane.step2' | transloco,
              'offline.airplane.step3' | transloco,
              'offline.airplane.step4' | transloco,
            ]"
          />
          @if (testedOn(); as date) {
            <mk-banner
              tone="info"
              icon="circle-check"
              [title]="'offline.airplane.tested' | transloco: { date: date }"
              data-testid="offline.airplane.tested"
            />
          } @else {
            <p mk-text tone="ink-2" data-testid="offline.airplane.never">
              {{ 'offline.airplane.never' | transloco }}
            </p>
          }
        </mk-stack>
      </mk-section>
    </mk-stack>
  `,
})
export default class OfflinePage {
  /** Bound from the trip route's parameter. */
  readonly tripId = input.required<string>()

  protected readonly connection = inject(ConnectionStatusStore)
  protected readonly store = inject(ReadyToFlyStore)
  private readonly versions = inject(AppVersionStore)
  private readonly sheets = inject(SheetService)
  private readonly clock = inject(CLOCK)
  private readonly zone = inject(TIME_ZONE)
  private readonly locale = intlLocale()
  private readonly lastOutcome = signal<DownloadOutcome | null>(null)

  protected readonly rows = computed<CheckRow[]>(() =>
    (this.store.readiness()?.checks ?? []).map((check) => this.row(check))
  )
  protected readonly toFix = computed(() => this.rows().filter((row) => !row.ok).length)
  protected readonly notReadyKey = computed(
    () => `offline.ready.${countKey('notYet', this.toFix())}`
  )

  protected readonly outcome = computed(() => {
    const outcome = this.lastOutcome()
    switch (outcome?.kind) {
      case undefined:
        return null
      case 'offline':
        return { key: 'offline.download.offline', count: 0 }
      case 'failed':
        return { key: 'offline.download.stopped', count: 0 }
      case 'done':
        return outcome.failedDocuments > 0
          ? {
              key: `offline.download.${countKey('failed', outcome.failedDocuments)}`,
              count: outcome.failedDocuments,
            }
          : { key: 'offline.download.done', count: 0 }
    }
  })

  protected readonly testedOn = computed(() => {
    const at = this.store.lastOfflineBootAt()
    if (!at) {
      return null
    }
    const locale = this.locale()
    return `${formatDayDate(localToday(at, this.zone), locale)} ${clockTimeIn(at, this.zone, locale)}`
  })

  constructor() {
    effect(() => this.store.tripId.set(this.tripId()))
    void this.versions.refresh().then(() => this.store.refresh())
    void this.store.refresh()
  }

  protected async downloadEverything(): Promise<void> {
    this.lastOutcome.set(null)
    this.lastOutcome.set(await this.store.downloadEverything())
  }

  protected async fixCheck(key: ReadinessCheckKey): Promise<void> {
    switch (key) {
      case 'version':
        return this.store.fixVersion()
      case 'snapshot':
      case 'outbox':
        return this.store.syncNow()
      case 'documents':
        return this.store.saveDocuments()
      case 'assets':
        return this.store.warmAssets()
      case 'storage':
        return this.store.persistStorage()
      case 'installed':
        this.sheets.open(OfflineInstallSheet)
        return
    }
  }

  private row(check: ReadinessCheck): CheckRow {
    const status: CheckRow['status'] = check.notApplicable
      ? { tone: 'good', icon: 'circle-check', key: 'offline.ready.notApplicable' }
      : check.ok
        ? { tone: 'good', icon: 'circle-check', key: 'offline.ready.ok' }
        : { tone: 'critical', icon: 'circle-x', key: 'offline.ready.bad' }
    return {
      key: check.key,
      icon: CHECK_ICONS[check.key],
      ok: check.ok,
      detail: this.detail(check),
      status,
      fix: check.ok ? null : this.fixLabel(check.key),
    }
  }

  private fixLabel(key: ReadinessCheckKey): string {
    if (key === 'version' && this.store.updatePending()) {
      return 'offline.checks.version.reload'
    }
    return `offline.checks.${key}.fix`
  }

  private detail(check: ReadinessCheck): CheckRow['detail'] {
    const base = `offline.checks.${check.key}`
    switch (check.key) {
      case 'version': {
        if (this.store.updatePending()) {
          return { key: `${base}.pending`, params: {} }
        }
        const version = this.versions.info()?.version
        return check.ok && version
          ? { key: `${base}.ok`, params: { version } }
          : { key: `${base}.bad`, params: {} }
      }
      case 'snapshot': {
        if (check.ageMs === undefined) {
          return { key: `${base}.never`, params: {} }
        }
        const now = this.clock()
        const age = relativeTime({
          instant: new Date(Date.parse(now) - check.ageMs).toISOString(),
          now,
          timeZone: this.zone,
          locale: this.locale(),
        })
        return { key: check.ok ? `${base}.ok` : `${base}.stale`, params: { age } }
      }
      case 'documents': {
        const bad = check.documentIds?.length ?? 0
        if (bad > 0) {
          return { key: `${base}.${countKey('bad', bad)}`, params: { count: bad } }
        }
        const saved = this.store.savableCount()
        return saved === 0
          ? { key: `${base}.none`, params: {} }
          : { key: `${base}.${countKey('ok', saved)}`, params: { count: saved } }
      }
      case 'assets':
        return { key: check.ok ? `${base}.ok` : `${base}.bad`, params: {} }
      case 'storage':
        return {
          key: check.ok
            ? `${base}.ok`
            : this.store.storagePersisted()
              ? `${base}.noRoom`
              : `${base}.notPersisted`,
          params: {},
        }
      case 'outbox': {
        const count = check.count ?? 0
        return count === 0
          ? { key: `${base}.ok`, params: {} }
          : { key: `${base}.${countKey('bad', count)}`, params: { count } }
      }
      case 'installed':
        return {
          key: check.notApplicable
            ? `${base}.notApplicable`
            : check.ok
              ? `${base}.ok`
              : `${base}.bad`,
          params: {},
        }
    }
  }
}
