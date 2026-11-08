import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  inject,
  signal,
} from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import type { DocumentTag } from '@monkitrips/shared'
import { type ApiFailure, toApiFailure } from '../../core/api/api-failure'
import { intlLocale } from '../../core/i18n/intl-locale'
import { DocumentCopiesStore, type StorageStatus } from '../../core/offline/document-copies.store'
import { DocumentsStore } from '../../core/offline/documents.store'
import { OnlineStore } from '../../core/offline/online.store'
import { documentRecord, tripEvents } from '../../core/offline/trip-queries'
import { documentOfflineState } from '../../domain/document-offline-state'
import { formatFileSize } from '../../domain/file-size'
import { storagePressure } from '../../domain/storage-warning'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkBannerComponent } from '../../shared/ui/banner/banner.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkChipComponent } from '../../shared/ui/chip/chip.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkDocumentPreviewComponent } from '../../shared/ui/document-preview/document-preview.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { MkSwitchComponent } from '../../shared/ui/switch/switch.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { TOAST_WITH_ACTION_DURATION_MS, ToastService } from '../../shared/ui/toast/toast.service'
import { BOOKING_EXTRACTION_API } from './booking-extraction-api'
import { readableAsBooking } from './booking-readable'
import {
  BookingReviewSheet,
  type BookingReviewData,
  type BookingReviewResult,
} from './booking-review.sheet'
import { provideDocsI18n } from './docs-i18n'
import { EXTRACTION_ERROR_CODES } from './extraction-error-codes'
import { fileOf, download, shareOrDownload } from './document-share'
import { OFFLINE_STATE_LOOK, TAGS, TAG_ICONS, toggleTag } from './document-tags'

export interface DocumentDetailData {
  tripId: string
  docId: string
}

/**
 * One document, live from the device: quick view (the saved copy when
 * there is one, so it opens offline; images by object URL, PDFs drawn by
 * pdf.js), download, share, the "Save offline" switch with the device's
 * storage estimate, the tags and the event, delete with undo. A link opens
 * in the browser instead. A PDF or a photo can be read as a booking
 * (online, through the AI provider): the proposal opens in the review
 * sheet and nothing is written until the member accepts it.
 */
@Component({
  selector: 'app-document-detail-sheet',
  imports: [
    TranslocoPipe,
    MkSheetComponent,
    MkApiErrorComponent,
    MkBannerComponent,
    MkButtonComponent,
    MkChipComponent,
    MkDocumentPreviewComponent,
    MkEmptyStateComponent,
    MkFieldComponent,
    MkInputDirective,
    MkIconComponent,
    MkRowComponent,
    MkSectionComponent,
    MkStackComponent,
    MkListComponent,
    MkListRowComponent,
    MkSwitchComponent,
    MkTextComponent,
  ],
  providers: [provideDocsI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="document()?.title ?? ('docs.detail.title' | transloco)">
      @if (document(); as document) {
        <mk-stack gap="2" data-testid="docs.detail">
          <mk-row gap="1" [wrap]="true">
            <mk-chip
              variant="status"
              [tone]="look[state()].tone"
              [icon]="look[state()].icon"
              data-testid="docs.detail.offline"
            >
              {{ 'docs.offline.' + state() | transloco }}
            </mk-chip>
          </mk-row>

          @if (document.kind === 'link') {
            @if (document.url; as url) {
              <a
                mk-button
                size="block"
                [href]="url"
                target="_blank"
                rel="noopener"
                data-testid="docs.detail.openLink"
              >
                <mk-icon name="external-link" [size]="18" />
                {{ 'docs.detail.openLink' | transloco }}
              </a>
            }
          } @else {
            @if (viewing()) {
              <mk-document-preview
                [blob]="bytes()"
                [mime]="document.mime"
                [label]="document.title"
                data-testid="docs.detail.preview"
              />
            }
            @if (needsConnection()) {
              <p mk-text tone="ink-2" data-testid="docs.detail.needsConnection">
                {{ 'docs.detail.needsConnection' | transloco }}
              </p>
            }
            <mk-stack gap="1">
              @if (!viewing()) {
                <button
                  mk-button
                  size="block"
                  type="button"
                  [loading]="opening()"
                  data-testid="docs.detail.view"
                  (click)="view()"
                >
                  <mk-icon name="eye" [size]="18" />
                  {{ 'docs.detail.view' | transloco }}
                </button>
              }
              <mk-row gap="1">
                <button
                  mk-button
                  variant="secondary"
                  type="button"
                  data-testid="docs.detail.download"
                  (click)="hand('download')"
                >
                  <mk-icon name="download" [size]="18" />
                  {{ 'docs.detail.download' | transloco }}
                </button>
                <button
                  mk-button
                  variant="secondary"
                  type="button"
                  data-testid="docs.detail.share"
                  (click)="hand('share')"
                >
                  <mk-icon name="share" [size]="18" />
                  {{ 'docs.detail.share' | transloco }}
                </button>
              </mk-row>
            </mk-stack>

            @if (readable()) {
              <mk-section [eyebrow]="'docs.read.title' | transloco">
                <mk-stack gap="1" data-testid="docs.detail.read">
                  @if (reading()) {
                    <mk-empty-state
                      mascot="thinking"
                      [title]="'docs.read.reading' | transloco"
                      data-testid="docs.detail.reading"
                    />
                  } @else {
                    <button
                      mk-button
                      variant="secondary"
                      size="block"
                      type="button"
                      [disabled]="!online()"
                      data-testid="docs.detail.readBooking"
                      (click)="readBooking()"
                    >
                      <mk-icon name="file-text" [size]="18" />
                      {{ 'docs.read.action' | transloco }}
                    </button>
                  }
                  @if (!online()) {
                    <p mk-text variant="caption" tone="ink-2" data-testid="docs.detail.readOffline">
                      {{ 'docs.read.offline' | transloco }}
                    </p>
                  }
                  <p mk-text variant="caption" tone="ink-2" data-testid="docs.detail.readPrivacy">
                    {{ 'docs.read.privacy' | transloco }}
                  </p>
                  <mk-api-error
                    [failure]="readFailure()"
                    scope="docs"
                    [knownCodes]="readErrorCodes"
                    testId="docs.detail.readError"
                  />
                </mk-stack>
              </mk-section>
            }

            <mk-section [eyebrow]="'docs.detail.offlineState' | transloco">
              <mk-stack gap="1">
                <mk-switch
                  [checked]="hasCopy()"
                  [disabled]="state() === 'saving' || (!hasCopy() && !online())"
                  (checkedChange)="setOffline($event)"
                  testId="docs.detail.saveOffline"
                >
                  {{ 'docs.detail.saveOffline' | transloco }}
                </mk-switch>
                @if (state() === 'mismatch') {
                  <mk-banner
                    tone="serious"
                    icon="alert-triangle"
                    role="alert"
                    [title]="'docs.offline.mismatch' | transloco"
                    [body]="'docs.detail.mismatchBody' | transloco"
                    data-testid="docs.detail.mismatch"
                  >
                    <button
                      mkBannerAction
                      mk-button
                      variant="ghost"
                      size="sm"
                      type="button"
                      [disabled]="!online()"
                      (click)="save()"
                    >
                      {{ 'docs.detail.resave' | transloco }}
                    </button>
                  </mk-banner>
                }
                @if (storage(); as storage) {
                  @if (storage.estimate) {
                    <p mk-text variant="caption" tone="ink-2" data-testid="docs.detail.storage">
                      {{
                        'docs.detail.storage'
                          | transloco
                            : { used: size(storage.copiesBytes), free: size(storage.freeBytes) }
                      }}
                    </p>
                  } @else {
                    <p mk-text variant="caption" tone="ink-3">
                      {{ 'docs.detail.storageUnknown' | transloco }}
                    </p>
                  }
                  @if (storage.warning) {
                    <mk-banner
                      tone="serious"
                      icon="hard-drive"
                      role="alert"
                      [title]="'docs.detail.storageWarning' | transloco"
                      data-testid="docs.detail.storageWarning"
                    />
                  }
                }
              </mk-stack>
            </mk-section>
          }

          <mk-section [eyebrow]="'docs.detail.tags' | transloco">
            <mk-row gap="1" [wrap]="true" data-testid="docs.detail.tags">
              @for (tag of tags; track tag) {
                <mk-chip
                  [selectable]="true"
                  [icon]="tagIcons[tag]"
                  [selected]="document.tags.includes(tag)"
                  (selectedChange)="setTag(tag, $event)"
                  [attr.data-testid]="'docs.detail.tag.' + tag"
                >
                  {{ 'docs.tags.' + tag | transloco }}
                </mk-chip>
              }
            </mk-row>
          </mk-section>

          @if (events().length > 0) {
            <mk-field [label]="'docs.detail.event' | transloco">
              <select mkInput (change)="setEvent($event)" data-testid="docs.detail.event">
                <option value="" [selected]="!document.eventId">
                  {{ 'docs.upload.noEvent' | transloco }}
                </option>
                @for (event of events(); track event.id) {
                  <option [value]="event.id" [selected]="event.id === document.eventId">
                    {{ event.title }}
                  </option>
                }
              </select>
            </mk-field>
          }

          @if (document.kind === 'file') {
            <mk-list>
              <mk-list-row
                [title]="'docs.detail.size' | transloco"
                [value]="size(document.sizeBytes)"
              />
              @if (document.mime) {
                <mk-list-row [title]="'docs.detail.type' | transloco" [value]="document.mime" />
              }
            </mk-list>
          }

          <button
            mk-button
            variant="destructive"
            size="block"
            type="button"
            data-testid="docs.detail.delete"
            (click)="remove()"
          >
            <mk-icon name="trash-2" [size]="18" />
            {{ 'docs.detail.delete' | transloco }}
          </button>
        </mk-stack>
      } @else if (loaded()) {
        <p mk-text tone="ink-2" data-testid="docs.detail.gone">
          {{ 'docs.detail.gone' | transloco }}
        </p>
      }
    </mk-sheet>
  `,
})
export class DocumentDetailSheet {
  private readonly data = inject<DocumentDetailData>(DIALOG_DATA)
  private readonly ref = inject<DialogRef<void>>(DialogRef)
  private readonly store = inject(DocumentsStore)
  private readonly copies = inject(DocumentCopiesStore)
  private readonly toasts = inject(ToastService)
  private readonly sheets = inject(SheetService)
  private readonly extraction = inject(BOOKING_EXTRACTION_API)
  private readonly transloco = inject(TranslocoService)
  private readonly window = inject(DOCUMENT).defaultView
  private readonly locale = intlLocale()
  protected readonly online = inject(OnlineStore).online

  protected readonly tags = TAGS
  protected readonly tagIcons = TAG_ICONS
  protected readonly look = OFFLINE_STATE_LOOK
  protected readonly readErrorCodes = EXTRACTION_ERROR_CODES

  private readonly docId = signal(this.data.docId)
  private readonly tripId = signal(this.data.tripId)
  private readonly loadedDocument = documentRecord(this.docId)
  protected readonly document = computed(() => this.loadedDocument()?.document ?? null)
  protected readonly loaded = computed(() => this.loadedDocument() !== null)
  protected readonly events = tripEvents(this.tripId)

  protected readonly viewing = signal(false)
  protected readonly opening = signal(false)
  protected readonly bytes = signal<Blob | null>(null)
  protected readonly needsConnection = signal(false)
  protected readonly reading = signal(false)
  protected readonly readFailure = signal<ApiFailure | null>(null)
  /** A PDF or an image file can be read as a booking. */
  protected readonly readable = computed(() => readableAsBooking(this.document()))
  private readonly device = signal<Pick<StorageStatus, 'estimate' | 'persisted'> | null>(null)
  /** The estimate read on open and after each change, against the copies' live size. */
  protected readonly storage = computed<StorageStatus | null>(() => {
    const device = this.device()
    if (!device) {
      return null
    }
    const copiesBytes = this.copies.copiesBytes()
    return { ...device, ...storagePressure(device.estimate, copiesBytes), copiesBytes }
  })

  protected readonly hasCopy = computed(() => this.copies.copies().has(this.data.docId))
  protected readonly state = computed(() => {
    const document = this.document()
    if (!document) {
      return 'not_saved' as const
    }
    return documentOfflineState(
      document,
      this.copies.copies().get(document.id) ?? null,
      this.copies.saving().has(document.id)
    )
  })

  constructor() {
    void this.refreshStorage()
  }

  protected size(bytes: number | null): string {
    return formatFileSize(bytes, this.locale())
  }

  /** Opens the quick view from the saved copy, or downloads the bytes when online. */
  protected async view(): Promise<void> {
    const blob = await this.load()
    if (blob) {
      this.bytes.set(blob)
      this.viewing.set(true)
    }
  }

  protected async hand(how: 'download' | 'share'): Promise<void> {
    const document = this.document()
    const blob = await this.load()
    if (!document || !blob || !this.window) {
      return
    }
    const file = fileOf(blob, document.title)
    const target = {
      navigator: this.window.navigator,
      document: this.window.document,
      url: this.window.URL,
    }
    try {
      if (how === 'share') {
        await shareOrDownload(target, file, document.title)
      } else {
        download(target, file)
      }
    } catch {
      this.toasts.show({ message: this.transloco.translate('docs.toast.shareFailed') })
    }
  }

  /** Asks the server to read the file, then opens the proposal for review. */
  protected async readBooking(): Promise<void> {
    const document = this.document()
    if (!document || !this.online() || this.reading()) {
      return
    }
    this.reading.set(true)
    this.readFailure.set(null)
    try {
      const action = await this.extraction.extract(this.data.tripId, document.id)
      this.sheets.open<BookingReviewResult, BookingReviewData>(BookingReviewSheet, {
        data: { tripId: this.data.tripId, action },
        label: this.transloco.translate('docs.review.title'),
      })
    } catch (error) {
      this.readFailure.set(toApiFailure(error))
    } finally {
      this.reading.set(false)
    }
  }

  protected async setOffline(on: boolean): Promise<void> {
    if (on) {
      await this.save()
    } else {
      await this.copies.remove(this.data.docId)
      this.toasts.show({ message: this.transloco.translate('docs.toast.removedCopy') })
      await this.refreshStorage()
    }
  }

  protected async save(): Promise<void> {
    const document = this.document()
    if (!document) {
      return
    }
    try {
      const result = await this.copies.save(document)
      this.toasts.show({
        message: this.transloco.translate(
          result.verified ? 'docs.toast.saved' : 'docs.toast.mismatch'
        ),
      })
    } catch {
      this.toasts.show({ message: this.transloco.translate('docs.toast.saveFailed') })
    }
    await this.refreshStorage()
  }

  protected async setTag(tag: DocumentTag, on: boolean): Promise<void> {
    const document = this.document()
    if (document && document.tags.includes(tag) !== on) {
      await this.store.update(document.id, { tags: toggleTag(document.tags, tag, on) })
    }
  }

  protected async setEvent(event: Event): Promise<void> {
    const document = this.document()
    const eventId = (event.target as HTMLSelectElement).value || null
    if (document && eventId !== document.eventId) {
      await this.store.update(document.id, { eventId })
    }
  }

  protected async remove(): Promise<void> {
    const deferred = await this.store.removeWithUndo(this.data.docId, TOAST_WITH_ACTION_DURATION_MS)
    this.toasts.showUndo(this.transloco.translate('docs.toast.deleted'), () => void deferred.undo())
    this.ref.close()
  }

  private async load(): Promise<Blob | null> {
    const document = this.document()
    if (!document || document.kind !== 'file') {
      return null
    }
    this.needsConnection.set(false)
    this.opening.set(true)
    try {
      return await this.copies.open(document)
    } catch {
      this.needsConnection.set(true)
      return null
    } finally {
      this.opening.set(false)
    }
  }

  private async refreshStorage(): Promise<void> {
    try {
      const { estimate, persisted } = await this.copies.status()
      this.device.set({ estimate, persisted })
    } catch {
      this.device.set(null)
    }
  }
}
