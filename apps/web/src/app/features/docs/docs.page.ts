import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core'
import { RouterLink, RouterOutlet } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { hasTag, type DocumentTag } from '@monkitrips/shared'
import { intlLocale } from '../../core/i18n/intl-locale'
import { scopedLabels } from '../../core/i18n/scoped-labels'
import { CLOCK } from '../../core/offline/clock'
import { DocumentCopiesStore } from '../../core/offline/document-copies.store'
import { DocumentsStore } from '../../core/offline/documents.store'
import type { DocRecord } from '../../core/offline/records'
import { SyncService } from '../../core/offline/sync.service'
import { TIME_ZONE } from '../../core/offline/time-zone'
import { tripEvents } from '../../core/offline/trip-queries'
import { groupDocumentsByWhen } from '../../domain/document-groups'
import {
  documentOfflineState,
  type DocumentOfflineState,
} from '../../domain/document-offline-state'
import { formatFileSize } from '../../domain/file-size'
import { localToday } from '../../domain/local-today'
import { MkBannerComponent } from '../../shared/ui/banner/banner.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkChipComponent } from '../../shared/ui/chip/chip.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import type { IconName } from '../../shared/ui/icon/icon-names'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { provideDocsI18n } from './docs-i18n'
import { OFFLINE_STATE_LOOK, TAGS, TAG_ICONS } from './document-tags'
import { UploadSheet, type UploadSheetData, type UploadSheetResult } from './upload.sheet'

interface DocRow {
  document: DocRecord
  icon: IconName
  meta: string
  state: DocumentOfflineState
}

/**
 * The Docs tab: every document of the trip in one place, grouped by when
 * it matters (today, upcoming, other) relative to its event, filterable
 * by requirement tag, each row with its tags and offline state. Documents
 * tagged `print` raise the full-width "Bring this printed" band on top.
 * `docs/:docId` opens the detail sheet over the list.
 */
@Component({
  selector: 'app-docs-page',
  imports: [
    RouterLink,
    RouterOutlet,
    TranslocoPipe,
    MkBannerComponent,
    MkButtonComponent,
    MkChipComponent,
    MkEmptyStateComponent,
    MkIconComponent,
    MkRowComponent,
    MkSectionComponent,
    MkStackComponent,
    MkListComponent,
    MkListRowComponent,
    MkTextComponent,
  ],
  providers: [provideDocsI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="3">
      @if (toPrint().length > 0) {
        <mk-banner
          tone="print"
          icon="printer"
          role="alert"
          [title]="'docs.print.title' | transloco"
          [body]="
            toPrint().length === 1
              ? ('docs.print.one' | transloco: { title: toPrint()[0].title })
              : ('docs.print.many' | transloco: { count: toPrint().length, titles: printTitles() })
          "
          data-testid="docs.print"
        >
          <a
            mkBannerAction
            [routerLink]="['/t', tripId(), 'docs', toPrint()[0].id]"
            data-testid="docs.print.open"
          >
            {{ 'docs.print.open' | transloco }}
          </a>
        </mk-banner>
      }

      <mk-row justify="between" gap="2">
        <h1 mk-text variant="title" data-testid="docs.title">{{ 'docs.title' | transloco }}</h1>
        @if (documents().length > 0) {
          <button
            mk-button
            variant="secondary"
            size="sm"
            type="button"
            data-testid="docs.add"
            (click)="add()"
          >
            <mk-icon name="plus" [size]="18" />
            {{ 'docs.add' | transloco }}
          </button>
        }
      </mk-row>

      @if (documents().length === 0) {
        <mk-empty-state
          icon="id-card"
          [title]="'docs.empty.title' | transloco"
          [body]="'docs.empty.body' | transloco"
          data-testid="docs.empty"
        >
          <button
            mkEmptyAction
            mk-button
            type="button"
            data-testid="docs.empty.add"
            (click)="add()"
          >
            <mk-icon name="upload" [size]="18" />
            {{ 'docs.empty.action' | transloco }}
          </button>
        </mk-empty-state>
      } @else {
        <mk-row
          gap="1"
          [wrap]="true"
          role="group"
          [attr.aria-label]="'docs.filters.label' | transloco"
          data-testid="docs.filters"
        >
          <mk-chip
            [selectable]="true"
            [selected]="filter() === null"
            (selectedChange)="filter.set(null)"
            data-testid="docs.filter.all"
          >
            {{ 'docs.filters.all' | transloco }}
          </mk-chip>
          @for (tag of tags; track tag) {
            <mk-chip
              [selectable]="true"
              [icon]="tagIcons[tag]"
              [selected]="filter() === tag"
              (selectedChange)="filter.set($event ? tag : null)"
              [attr.data-testid]="'docs.filter.' + tag"
            >
              {{ 'docs.tags.' + tag | transloco }}
            </mk-chip>
          }
        </mk-row>

        @if (groups().length === 0) {
          <p mk-text tone="ink-2" data-testid="docs.emptyFilter">
            {{ 'docs.emptyFilter' | transloco }}
          </p>
        }
        @for (group of groups(); track group.when) {
          <mk-section
            [eyebrow]="('docs.group.' + group.when | transloco) + ' · ' + group.rows.length"
            [attr.data-testid]="'docs.group.' + group.when"
          >
            <mk-list>
              @for (row of group.rows; track row.document.id) {
                <mk-list-row
                  [title]="row.document.title"
                  [meta]="row.meta"
                  [icon]="row.icon"
                  [link]="['/t', tripId(), 'docs', row.document.id]"
                  testId="docs.row"
                  [attr.data-doc-id]="row.document.id"
                  [attr.data-offline]="row.state"
                >
                  <mk-row mkRowExtra gap="half" [wrap]="true">
                    @for (tag of row.document.tags; track tag) {
                      <mk-chip variant="tag" [icon]="tagIcons[tag]" data-testid="docs.row.tag">
                        {{ 'docs.tags.' + tag | transloco }}
                      </mk-chip>
                    }
                    <mk-chip
                      variant="status"
                      [tone]="look[row.state].tone"
                      [icon]="look[row.state].icon"
                      data-testid="docs.row.offline"
                    >
                      {{ 'docs.offline.' + row.state | transloco }}
                    </mk-chip>
                    @if (row.document.syncState) {
                      <mk-chip variant="status" data-testid="docs.row.pending">
                        {{
                          (row.document.syncState === 'failed'
                            ? 'docs.row.failed'
                            : 'docs.row.pending'
                          ) | transloco
                        }}
                      </mk-chip>
                    }
                  </mk-row>
                </mk-list-row>
              }
            </mk-list>
          </mk-section>
        }
      }
    </mk-stack>
    <router-outlet />
  `,
})
export default class DocsPage {
  /** Bound from the parent route's parameter. */
  readonly tripId = input.required<string>()

  private readonly store = inject(DocumentsStore)
  private readonly copies = inject(DocumentCopiesStore)
  private readonly sheets = inject(SheetService)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)
  private readonly clock = inject(CLOCK)
  private readonly timeZone = inject(TIME_ZONE)
  private readonly locale = intlLocale()

  protected readonly tags = TAGS
  protected readonly tagIcons = TAG_ICONS
  protected readonly look = OFFLINE_STATE_LOOK
  protected readonly filter = signal<DocumentTag | null>(null)

  protected readonly documents = this.store.forTrip(this.tripId)
  private readonly events = tripEvents(this.tripId)
  private readonly today = signal(localToday(this.clock(), this.timeZone))

  protected readonly toPrint = computed(() =>
    this.documents()
      .filter((document) => hasTag(document, 'print'))
      .sort((a, b) => a.title.localeCompare(b.title))
  )

  protected readonly printTitles = computed(() =>
    this.toPrint()
      .map((document) => document.title)
      .join(', ')
  )
  private readonly rowLabels = scopedLabels('docs', ['row.wholeTrip', 'row.link'])

  protected readonly groups = computed(() => {
    const tag = this.filter()
    const events = this.events()
    const titles = new Map(events.map((event) => [event.id, event.title]))
    const copies = this.copies.copies()
    const saving = this.copies.saving()
    const visible = this.documents().filter((document) => !tag || hasTag(document, tag))
    return groupDocumentsByWhen(visible, events, this.today()).map((group) => ({
      when: group.when,
      rows: group.documents.map((document): DocRow => {
        const event = document.eventId ? titles.get(document.eventId) : undefined
        const [wholeTrip, link] = this.rowLabels()
        const where = event ?? wholeTrip
        const size =
          document.kind === 'link' ? link : formatFileSize(document.sizeBytes, this.locale())
        return {
          document,
          icon: iconOf(document),
          meta: [where, size].filter(Boolean).join(' · '),
          state: documentOfflineState(
            document,
            copies.get(document.id) ?? null,
            saving.has(document.id)
          ),
        }
      }),
    }))
  })

  constructor() {
    inject(SyncService).requestSync()
  }

  protected add(): void {
    const data: UploadSheetData = {
      tripId: this.tripId(),
      events: this.events().map((event) => ({ id: event.id, title: event.title })),
    }
    const ref = this.sheets.open<UploadSheetResult, UploadSheetData>(UploadSheet, {
      data,
      label: this.transloco.translate('docs.upload.title'),
    })
    ref.closed.subscribe((result) => {
      if (result?.added) {
        this.toasts.show({ message: this.transloco.translate('docs.toast.uploaded') })
      }
    })
  }
}

function iconOf(document: DocRecord): IconName {
  if (document.kind === 'link') return 'link'
  return document.mime?.startsWith('image/') ? 'image' : 'file-text'
}
