import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core'
import { Router } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { DOCUMENT_TAGS, type DocumentTag } from '@monkitrips/shared'
import { intlLocale } from '../../core/i18n/intl-locale'
import { DocumentsStore } from '../../core/offline/documents.store'
import { liveSignal } from '../../core/offline/live'
import { META_ACTIVE_TRIP, MetaStore } from '../../core/offline/meta.store'
import { OnlineStore } from '../../core/offline/online.store'
import type { TripRecord } from '../../core/offline/records'
import { SHARE_INBOX, type SharedItem } from '../../core/offline/share-inbox'
import { checkUploadFile, type UploadRejection } from '../../domain/document-upload-check'
import { formatFileSize } from '../../domain/file-size'
import { MkBannerComponent } from '../../shared/ui/banner/banner.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkChipComponent } from '../../shared/ui/chip/chip.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { provideShareI18n } from './share-i18n'

interface InboxRow {
  item: SharedItem
  title: string
  meta: string
  rejection: UploadRejection | null
}

const TAG_ICONS = {
  print: 'printer',
  show_on_phone: 'smartphone',
  requires_passport: 'id-card',
} as const

/**
 * Where the Share Target lands (`/share`): the service worker stores the
 * shared files in the `share-inbox` IndexedDB database and redirects
 * here. The person picks the trip (the active one first) and the tags,
 * and the files are uploaded as documents of that trip (a shared link
 * becomes a link document); what was added leaves the inbox, what failed
 * stays for another try.
 */
@Component({
  selector: 'app-share-inbox-page',
  imports: [
    TranslocoPipe,
    MkBannerComponent,
    MkButtonComponent,
    MkChipComponent,
    MkEmptyStateComponent,
    MkFieldComponent,
    MkInputDirective,
    MkRowComponent,
    MkSectionComponent,
    MkStackComponent,
    MkListComponent,
    MkListRowComponent,
    MkTextComponent,
  ],
  providers: [provideShareI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="3">
      <h1 mk-text variant="title" data-testid="share.title">{{ 'share.title' | transloco }}</h1>
      @if (error() === 'store') {
        <mk-banner
          tone="critical"
          icon="circle-alert"
          role="alert"
          [title]="'share.storeError' | transloco"
          data-testid="share.storeError"
        />
      }
      @if (loaded() && rows().length === 0) {
        <mk-empty-state
          icon="inbox"
          [title]="'share.empty.title' | transloco"
          [body]="'share.empty.body' | transloco"
          data-testid="share.empty"
        />
      } @else if (rows().length > 0) {
        <mk-section [eyebrow]="'share.items' | transloco">
          <mk-list>
            @for (row of rows(); track row.item.id) {
              <mk-list-row
                [title]="row.title"
                [meta]="
                  row.rejection
                    ? ('share.' + (row.rejection === 'too_large' ? 'tooLarge' : 'unsupported')
                      | transloco)
                    : row.meta
                "
                [icon]="row.item.blob ? 'file-text' : 'link'"
                testId="share.item"
              >
                <button
                  mkRowTrailing
                  mk-button
                  variant="ghost"
                  size="sm"
                  type="button"
                  data-testid="share.item.discard"
                  (click)="discard(row.item)"
                >
                  {{ 'share.discard' | transloco }}
                </button>
              </mk-list-row>
            }
          </mk-list>
        </mk-section>

        @if (trips().length === 0) {
          <p mk-text tone="ink-2" data-testid="share.noTrips">{{ 'share.noTrips' | transloco }}</p>
        } @else {
          <mk-field [label]="'share.trip' | transloco">
            <select mkInput (change)="tripId.set(valueOf($event))" data-testid="share.trip">
              @for (trip of trips(); track trip.id) {
                <option [value]="trip.id" [selected]="trip.id === chosenTrip()">
                  {{ trip.name }}
                </option>
              }
            </select>
          </mk-field>
          <mk-stack gap="half">
            <span mk-text variant="label">{{ 'share.tags' | transloco }}</span>
            <mk-row gap="1" [wrap]="true">
              @for (tag of tags; track tag) {
                <mk-chip
                  [selectable]="true"
                  [icon]="tagIcons[tag]"
                  [selected]="picked().includes(tag)"
                  (selectedChange)="toggle(tag, $event)"
                  [attr.data-testid]="'share.tag.' + tag"
                >
                  {{ 'share.tagNames.' + tag | transloco }}
                </mk-chip>
              }
            </mk-row>
          </mk-stack>
          @if (!online()) {
            <p mk-text variant="caption" tone="ink-2" data-testid="share.offline">
              {{ 'share.offline' | transloco }}
            </p>
          }
          @if (failed()) {
            <p mk-text tone="status-critical" role="alert" data-testid="share.failed">
              {{ 'share.failed' | transloco }}
            </p>
          }
          <button
            mk-button
            size="block"
            type="button"
            [loading]="busy()"
            [disabled]="!online() || uploadable().length === 0"
            data-testid="share.submit"
            (click)="submit()"
          >
            {{ 'share.submit' | transloco }}
          </button>
        }
      }
    </mk-stack>
  `,
})
export default class ShareInboxPage {
  /** `?error=store` when the service worker could not keep the share. */
  readonly error = input<string | undefined>()

  private readonly inbox = inject(SHARE_INBOX)
  private readonly documents = inject(DocumentsStore)
  private readonly meta = inject(MetaStore)
  private readonly router = inject(Router)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)
  private readonly locale = intlLocale()
  protected readonly online = inject(OnlineStore).online

  protected readonly tags = DOCUMENT_TAGS
  protected readonly tagIcons = TAG_ICONS
  protected readonly items = signal<SharedItem[]>([])
  protected readonly loaded = signal(false)
  protected readonly picked = signal<DocumentTag[]>([])
  protected readonly busy = signal(false)
  protected readonly failed = signal(false)
  protected readonly tripId = signal<string | null>(null)
  private readonly activeTrip = this.meta.watch<string | null>(META_ACTIVE_TRIP, null)

  protected readonly trips = liveSignal<TripRecord[]>(
    async (db) => (await db.trips.toArray()).sort((a, b) => b.startDate.localeCompare(a.startDate)),
    []
  )

  /** The chosen trip: what the person picked, else the active trip, else the first. */
  protected readonly chosenTrip = computed(() => {
    const ids = this.trips().map((trip) => trip.id)
    const candidates = [this.tripId(), this.activeTrip(), ids[0] ?? null]
    return candidates.find((id) => id !== null && ids.includes(id)) ?? null
  })

  protected readonly rows = computed<InboxRow[]>(() =>
    this.items().map((item) => {
      const name = item.name ?? item.title ?? item.url ?? ''
      const check = item.blob
        ? checkUploadFile({ size: item.size, type: item.type ?? '', name: item.name ?? '' })
        : ({ ok: true } as const)
      return {
        item,
        title: name.replace(/\.[^./]+$/, '') || name,
        meta: item.blob ? formatFileSize(item.size, this.locale()) : (item.url ?? item.text ?? ''),
        rejection: check.ok ? null : check.reason,
      }
    })
  )

  protected readonly uploadable = computed(() =>
    this.rows().filter((row) => !row.rejection && (row.item.blob || sharedUrl(row.item)))
  )

  constructor() {
    void this.reload()
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLSelectElement).value
  }

  protected toggle(tag: DocumentTag, on: boolean): void {
    this.picked.update((tags) =>
      DOCUMENT_TAGS.filter((candidate) => (candidate === tag ? on : tags.includes(candidate)))
    )
  }

  protected async discard(item: SharedItem): Promise<void> {
    await this.inbox.remove(item.id)
    await this.reload()
  }

  protected async submit(): Promise<void> {
    const tripId = this.chosenTrip()
    if (!tripId || this.busy()) {
      return
    }
    this.busy.set(true)
    this.failed.set(false)
    let added = 0
    for (const row of this.uploadable()) {
      try {
        const common = { tripId, title: row.title, tags: this.picked(), eventId: null }
        const url = sharedUrl(row.item)
        if (row.item.blob) {
          await this.documents.uploadFile({
            ...common,
            file: row.item.blob,
            fileName: row.item.name ?? row.title,
          })
        } else if (url) {
          await this.documents.addLink({ ...common, url })
        }
        await this.inbox.remove(row.item.id)
        added += 1
      } catch {
        this.failed.set(true)
      }
    }
    this.busy.set(false)
    await this.reload()
    if (added > 0) {
      this.toasts.show({ message: this.transloco.translate('share.added', { count: added }) })
    }
    if (!this.failed()) {
      await this.router.navigate(['/t', tripId, 'docs'])
    }
  }

  private async reload(): Promise<void> {
    try {
      this.items.set(await this.inbox.list())
    } finally {
      this.loaded.set(true)
    }
  }
}

/** The address of a share without a file: the `url` field, or one inside the shared text. */
function sharedUrl(item: SharedItem): string | null {
  if (item.url) {
    return item.url
  }
  return /https?:\/\/\S+/.exec(item.text ?? '')?.[0] ?? null
}
