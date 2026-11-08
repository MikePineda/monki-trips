import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import {
  BOOKING_KINDS,
  type AiAction,
  type AiBookingProposal,
  type BookingDraft,
  type ExtractionReviewReason,
} from '@monkitrips/shared'
import { type ApiFailure, toApiFailure } from '../../core/api/api-failure'
import type { FieldError } from '../../core/i18n/form-messages'
import { intlLocale } from '../../core/i18n/intl-locale'
import { OnlineStore } from '../../core/offline/online.store'
import { SyncService } from '../../core/offline/sync.service'
import { formatDayDate } from '../../domain/day-date'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkChipComponent, type ChipTone } from '../../shared/ui/chip/chip.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import type { IconName } from '../../shared/ui/icon/icon-names'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { BOOKING_EXTRACTION_API } from './booking-extraction-api'
import { draftErrorPath, draftValue, withDraftValue } from './booking-draft-path'
import { bookingReviewGroups } from './booking-review-fields'
import { provideDocsI18n } from './docs-i18n'
import { EXTRACTION_ERROR_CODES } from './extraction-error-codes'

export interface BookingReviewData {
  tripId: string
  /** The proposed `extract_booking` action the server answered. */
  action: AiAction
}

/** The sheet closes with the decided action, or with nothing when dismissed. */
export type BookingReviewResult = { action: AiAction } | undefined

/** Icon and tone of each review reason; the reason's word always goes next to them. */
export const REVIEW_FLAG_LOOK: Record<ExtractionReviewReason, { icon: IconName; tone: ChipTone }> =
  {
    needs_review: { icon: 'alert-triangle', tone: 'warning' },
    low_confidence: { icon: 'circle-alert', tone: 'warning' },
    missing: { icon: 'circle-x', tone: 'serious' },
  }

function copyDraft(draft: BookingDraft): BookingDraft {
  return JSON.parse(JSON.stringify(draft)) as BookingDraft
}

/**
 * What the model read from a booking, for the member to check before
 * anything is written: every field editable, the ones the server flagged
 * marked with an icon and a word (never colour alone), the nights the
 * booking would cover. Accept sends the member's corrections first
 * (`revise`) when there are any, then accepts; the event and the
 * document's link arrive with the next pull. Reject discards the proposal.
 * Online only.
 */
@Component({
  selector: 'app-booking-review-sheet',
  imports: [
    TranslocoPipe,
    MkSheetComponent,
    MkApiErrorComponent,
    MkButtonComponent,
    MkChipComponent,
    MkFieldComponent,
    MkInputDirective,
    MkRowComponent,
    MkSectionComponent,
    MkStackComponent,
    MkTextComponent,
  ],
  providers: [provideDocsI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'docs.review.title' | transloco">
      <mk-stack gap="2" data-testid="docs.review">
        <p mk-text tone="ink-2">{{ 'docs.review.intro' | transloco }}</p>

        <mk-field [label]="'docs.review.field.kind' | transloco">
          <select mkInput data-testid="docs.review.field.kind" (change)="edit('kind', $event)">
            @for (kind of kinds; track kind) {
              <option [value]="kind" [selected]="kind === draft().kind">
                {{ 'docs.review.kind.' + kind | transloco }}
              </option>
            }
          </select>
        </mk-field>
        @if (flagOf('kind'); as flag) {
          <mk-chip
            variant="status"
            [tone]="look[flag].tone"
            [icon]="look[flag].icon"
            data-testid="docs.review.flag.kind"
            [attr.data-reason]="flag"
          >
            {{ 'docs.review.flag.' + flag | transloco }}
          </mk-chip>
        }

        @for (group of groups(); track group.id) {
          <mk-section
            [eyebrow]="'docs.review.group.' + group.title | transloco: { n: group.n }"
            [attr.data-testid]="'docs.review.group.' + group.id"
          >
            <mk-stack gap="1">
              @for (field of group.fields; track field.path) {
                <mk-stack gap="half">
                  <mk-field
                    [label]="'docs.review.field.' + field.label | transloco"
                    [error]="errorOf(field.path)"
                  >
                    <input
                      mkInput
                      [type]="field.input === 'datetime-local' ? 'datetime-local' : 'text'"
                      [variant]="field.input === 'code' ? 'code' : 'text'"
                      [value]="valueOf(field.path)"
                      [attr.data-testid]="'docs.review.field.' + field.path"
                      (input)="edit(field.path, $event)"
                    />
                  </mk-field>
                  @if (flagOf(field.path); as flag) {
                    <mk-row>
                      <mk-chip
                        variant="status"
                        [tone]="look[flag].tone"
                        [icon]="look[flag].icon"
                        [attr.data-testid]="'docs.review.flag.' + field.path"
                        [attr.data-reason]="flag"
                      >
                        {{ 'docs.review.flag.' + flag | transloco }}
                      </mk-chip>
                    </mk-row>
                  }
                </mk-stack>
              }
            </mk-stack>
          </mk-section>
        }

        @if (nights().length > 0) {
          <mk-section [eyebrow]="'docs.review.nights' | transloco">
            <mk-stack gap="half" data-testid="docs.review.nights">
              @for (night of nights(); track night.date) {
                <p mk-text data-testid="docs.review.night">
                  {{
                    'docs.review.night'
                      | transloco
                        : {
                            date: night.date,
                            before: night.before ?? ('docs.review.noBed' | transloco),
                            after: night.after ?? ('docs.review.noBed' | transloco),
                          }
                  }}
                </p>
              }
            </mk-stack>
          </mk-section>
        }

        @if (!online()) {
          <p mk-text tone="ink-2" data-testid="docs.review.offline">
            {{ 'docs.review.offline' | transloco }}
          </p>
        }
        <mk-api-error
          [failure]="failure()"
          scope="docs"
          [knownCodes]="knownCodes"
          testId="docs.review.error"
        />
      </mk-stack>

      <mk-row mkSheetFooter gap="1">
        <button
          mk-button
          variant="secondary"
          type="button"
          [disabled]="!online() || busy() !== null"
          [loading]="busy() === 'reject'"
          data-testid="docs.review.reject"
          (click)="reject()"
        >
          {{ 'docs.review.reject' | transloco }}
        </button>
        <button
          mk-button
          type="button"
          [disabled]="!online() || busy() !== null"
          [loading]="busy() === 'accept'"
          data-testid="docs.review.accept"
          (click)="accept()"
        >
          {{ 'docs.review.accept' | transloco }}
        </button>
      </mk-row>
    </mk-sheet>
  `,
})
export class BookingReviewSheet {
  private readonly data = inject<BookingReviewData>(DIALOG_DATA)
  private readonly ref = inject<DialogRef<BookingReviewResult>>(DialogRef)
  private readonly api = inject(BOOKING_EXTRACTION_API)
  private readonly sync = inject(SyncService)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)
  private readonly locale = intlLocale()
  protected readonly online = inject(OnlineStore).online

  protected readonly kinds = BOOKING_KINDS
  protected readonly look = REVIEW_FLAG_LOOK
  protected readonly knownCodes = EXTRACTION_ERROR_CODES

  private readonly action = signal(this.data.action)
  private readonly proposal = computed(() => this.action().proposal as AiBookingProposal)
  protected readonly draft = signal<BookingDraft>(copyDraft(this.proposal().draft))
  /** Whether the member changed anything since the server's last version of the draft. */
  protected readonly edited = computed(
    () => JSON.stringify(this.draft()) !== JSON.stringify(this.proposal().draft)
  )
  protected readonly groups = computed(() => bookingReviewGroups(this.draft()))
  private readonly flags = computed(
    () => new Map(this.proposal().review.map((flag) => [flag.field, flag.reason]))
  )
  protected readonly nights = computed(() =>
    this.proposal().changes.nights.map((night) => ({
      date: formatDayDate(night.date, this.locale()),
      before: night.before?.title ?? null,
      after: night.after?.title ?? null,
    }))
  )

  protected readonly fieldErrors = signal<ReadonlyMap<string, string>>(new Map())
  protected readonly failure = signal<ApiFailure | null>(null)
  protected readonly busy = signal<'accept' | 'reject' | null>(null)

  protected valueOf(path: string): string {
    return draftValue(this.draft(), path)
  }

  protected flagOf(path: string): ExtractionReviewReason | null {
    return this.flags().get(path) ?? null
  }

  protected errorOf(path: string): FieldError | null {
    const message = this.fieldErrors().get(path)
    return message ? { kind: 'server', message } : null
  }

  protected edit(path: string, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value
    this.draft.update((draft) => withDraftValue(draft, path, value))
    if (this.fieldErrors().has(path)) {
      const errors = new Map(this.fieldErrors())
      errors.delete(path)
      this.fieldErrors.set(errors)
    }
  }

  /** Sends the corrections first when there are any, then accepts. */
  protected async accept(): Promise<void> {
    if (this.busy() || !this.online()) {
      return
    }
    this.busy.set('accept')
    this.failure.set(null)
    const { tripId } = this.data
    try {
      if (this.edited()) {
        const revised = await this.api.revise(tripId, this.action().id, this.draft())
        this.action.set(revised)
        this.draft.set(copyDraft((revised.proposal as AiBookingProposal).draft))
        this.fieldErrors.set(new Map())
      }
      const accepted = await this.api.accept(tripId, this.action().id)
      this.sync.requestSync()
      this.toasts.show({ message: this.transloco.translate('docs.toast.bookingAdded') })
      this.ref.close({ action: accepted })
    } catch (error) {
      const failure = toApiFailure(error)
      this.fieldErrors.set(
        new Map(failure.fields.map((item) => [draftErrorPath(item.field), item.message]))
      )
      this.failure.set(failure)
    } finally {
      this.busy.set(null)
    }
  }

  protected async reject(): Promise<void> {
    if (this.busy() || !this.online()) {
      return
    }
    this.busy.set('reject')
    this.failure.set(null)
    try {
      const rejected = await this.api.reject(this.data.tripId, this.action().id)
      this.toasts.show({ message: this.transloco.translate('docs.toast.bookingDiscarded') })
      this.ref.close({ action: rejected })
    } catch (error) {
      this.failure.set(toApiFailure(error))
    } finally {
      this.busy.set(null)
    }
  }
}
