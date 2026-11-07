import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import type { DocumentTag } from '@monkitrips/shared'
import { ApiFailure } from '../../core/api/api-failure'
import type { FieldError } from '../../core/i18n/form-messages'
import { scopedLabels } from '../../core/i18n/scoped-labels'
import { DocumentRejected, DocumentsStore } from '../../core/offline/documents.store'
import { OnlineStore } from '../../core/offline/online.store'
import { checkUploadFile } from '../../domain/document-upload-check'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkChipComponent } from '../../shared/ui/chip/chip.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkSegmentedComponent } from '../../shared/ui/segmented/segmented.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { provideDocsI18n } from './docs-i18n'
import { TAGS, TAG_ICONS, toggleTag } from './document-tags'

export interface UploadSheetData {
  tripId: string
  /** Events of the trip a document may belong to. */
  events: readonly { id: string; title: string }[]
  /** Event preselected (opened from an event). */
  eventId?: string | null
}

export interface UploadSheetResult {
  added: boolean
}

type UploadKind = 'file' | 'link'

/**
 * Adds a document: a file (PDF or image, 20 MB at most, checked on the
 * device before anything is sent; needs a connection) or a link (written
 * through the outbox, works offline), with its title, event and tags.
 */
@Component({
  selector: 'app-docs-upload-sheet',
  imports: [
    TranslocoPipe,
    MkSheetComponent,
    MkFieldComponent,
    MkInputDirective,
    MkButtonComponent,
    MkChipComponent,
    MkRowComponent,
    MkStackComponent,
    MkSegmentedComponent,
    MkTextComponent,
  ],
  providers: [provideDocsI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'docs.upload.title' | transloco">
      <form novalidate (submit)="submit($event)" data-testid="docs.upload">
        <mk-stack gap="2">
          <mk-segmented
            [options]="kinds()"
            [value]="kind()"
            (valueChange)="setKind($event)"
            [label]="'docs.upload.kind' | transloco"
            testId="docs.upload.kind"
          />
          @if (kind() === 'file') {
            <mk-field
              [label]="'docs.upload.file' | transloco"
              [hint]="'docs.upload.fileHint' | transloco"
              [error]="fileError()"
              [required]="true"
            >
              <input
                mkInput
                type="file"
                accept="application/pdf,image/*"
                data-testid="docs.upload.file"
                (change)="pick($event)"
              />
            </mk-field>
            @if (!online()) {
              <p mk-text variant="caption" tone="ink-2" data-testid="docs.upload.offline">
                {{ 'docs.upload.offline' | transloco }}
              </p>
            }
          } @else {
            <mk-field
              [label]="'docs.upload.url' | transloco"
              [hint]="'docs.upload.urlHint' | transloco"
              [error]="urlError()"
              [required]="true"
            >
              <input
                mkInput
                type="url"
                inputmode="url"
                autocomplete="off"
                [value]="url()"
                (input)="url.set(valueOf($event))"
                data-testid="docs.upload.url"
              />
            </mk-field>
          }
          <mk-field
            [label]="'docs.upload.name' | transloco"
            [error]="titleError()"
            [required]="true"
          >
            <input
              mkInput
              type="text"
              autocomplete="off"
              maxlength="200"
              [value]="title()"
              (input)="title.set(valueOf($event))"
              data-testid="docs.upload.title"
            />
          </mk-field>
          @if (data.events.length > 0) {
            <mk-field [label]="'docs.upload.event' | transloco">
              <select
                mkInput
                [value]="eventId()"
                (change)="eventId.set(valueOf($event))"
                data-testid="docs.upload.event"
              >
                <option value="">{{ 'docs.upload.noEvent' | transloco }}</option>
                @for (event of data.events; track event.id) {
                  <option [value]="event.id" [selected]="event.id === eventId()">
                    {{ event.title }}
                  </option>
                }
              </select>
            </mk-field>
          }
          <mk-stack gap="half">
            <span mk-text variant="label">{{ 'docs.upload.tags' | transloco }}</span>
            <mk-row gap="1" [wrap]="true">
              @for (tag of tags; track tag) {
                <mk-chip
                  [selectable]="true"
                  [icon]="tagIcons[tag]"
                  [selected]="picked().includes(tag)"
                  (selectedChange)="picked.set(toggle(picked(), tag, $event))"
                  [attr.data-testid]="'docs.upload.tag.' + tag"
                >
                  {{ 'docs.tags.' + tag | transloco }}
                </mk-chip>
              }
            </mk-row>
          </mk-stack>
          @if (failure(); as failure) {
            <p mk-text tone="status-critical" role="alert" data-testid="docs.upload.error">
              {{ failure }}
            </p>
          }
          <button
            mk-button
            size="block"
            type="submit"
            [loading]="busy()"
            [disabled]="kind() === 'file' && !online()"
            data-testid="docs.upload.submit"
          >
            {{ 'docs.upload.submit' | transloco }}
          </button>
        </mk-stack>
      </form>
    </mk-sheet>
  `,
})
export class UploadSheet {
  protected readonly data = inject<UploadSheetData>(DIALOG_DATA)
  private readonly ref = inject<DialogRef<UploadSheetResult>>(DialogRef)
  private readonly store = inject(DocumentsStore)
  private readonly transloco = inject(TranslocoService)
  protected readonly online = inject(OnlineStore).online

  protected readonly tags = TAGS
  protected readonly tagIcons = TAG_ICONS
  protected readonly toggle = toggleTag

  protected readonly kind = signal<UploadKind>('file')
  protected readonly file = signal<File | null>(null)
  protected readonly url = signal('')
  protected readonly title = signal('')
  protected readonly eventId = signal(this.data.eventId ?? '')
  protected readonly picked = signal<DocumentTag[]>([])
  protected readonly busy = signal(false)
  protected readonly failure = signal<string | null>(null)
  private readonly submitted = signal(false)

  private readonly kindLabels = scopedLabels('docs', ['upload.kindFile', 'upload.kindLink'])
  protected readonly kinds = computed(() => [
    { id: 'file', label: this.kindLabels()[0] ?? '' },
    { id: 'link', label: this.kindLabels()[1] ?? '' },
  ])

  /** The picked file's problem, as soon as it is picked; "required" only after a submit. */
  protected readonly fileError = computed<FieldError | null>(() => {
    const file = this.file()
    if (!file) {
      return this.submitted() ? this.error('fileRequired') : null
    }
    const check = checkUploadFile({ size: file.size, type: file.type, name: file.name })
    if (check.ok) {
      return null
    }
    return this.error(check.reason === 'too_large' ? 'tooLarge' : 'unsupported')
  })

  protected readonly urlError = computed<FieldError | null>(() =>
    this.submitted() && !/^https?:\/\/\S+\.\S+/.test(this.url().trim())
      ? this.error('urlInvalid')
      : null
  )

  protected readonly titleError = computed<FieldError | null>(() =>
    this.submitted() && !this.title().trim() ? { kind: 'required' } : null
  )

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value
  }

  protected setKind(value: string | undefined): void {
    this.kind.set(value === 'link' ? 'link' : 'file')
    this.failure.set(null)
  }

  protected pick(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null
    this.file.set(file)
    this.failure.set(null)
    if (file && !this.title().trim()) {
      this.title.set(file.name.replace(/\.[^.]+$/, '').slice(0, 200))
    }
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault()
    this.submitted.set(true)
    const invalid =
      this.titleError() !== null ||
      (this.kind() === 'file' ? this.fileError() !== null : this.urlError() !== null)
    if (invalid || this.busy()) {
      return
    }
    this.busy.set(true)
    this.failure.set(null)
    try {
      const common = {
        tripId: this.data.tripId,
        title: this.title(),
        tags: this.picked(),
        eventId: this.eventId() || null,
      }
      const file = this.file()
      if (this.kind() === 'file' && file) {
        await this.store.uploadFile({ ...common, file, fileName: file.name })
      } else {
        await this.store.addLink({ ...common, url: this.url() })
      }
      this.ref.close({ added: true })
    } catch (error) {
      this.failure.set(this.messageOf(error))
    } finally {
      this.busy.set(false)
    }
  }

  private error(key: string): FieldError {
    return { kind: key, message: this.transloco.translate(`docs.upload.${key}`) }
  }

  private messageOf(error: unknown): string {
    if (error instanceof DocumentRejected) {
      return this.transloco.translate(
        `docs.upload.${error.reason === 'too_large' ? 'tooLarge' : 'unsupported'}`
      )
    }
    if (error instanceof ApiFailure) {
      if (error.kind === 'network') return this.transloco.translate('docs.upload.offline')
      if (error.is('E_FILE_TOO_LARGE')) return this.transloco.translate('docs.upload.tooLarge')
      if (error.is('E_UNSUPPORTED_FILE')) return this.transloco.translate('docs.upload.unsupported')
      if (error.message && error.code) return error.message
    }
    return this.transloco.translate('docs.upload.failed')
  }
}
