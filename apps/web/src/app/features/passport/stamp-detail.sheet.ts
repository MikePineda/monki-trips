import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { Router } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import type { ArrivalMode } from '@monkitrips/shared'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { MkStampComponent } from '../../shared/ui/stamp/stamp.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { providePassportI18n } from './passport-i18n'

export interface StampDetailData {
  /** The stamp's artwork key (`XA`, `XA-HARBOUR CITY`). */
  code: string
  place: string
  earned: boolean
  isoDate: string
  /** Already formatted for the locale. */
  date: string
  tripId: string
  tripName: string
  arrivedBy: ArrivalMode | null
  visits: { tripName: string; date: string; earned: boolean }[]
}

/**
 * When and on which trip a stamp was earned (or is coming up), how the
 * travellers arrived, and every visit to the place. One action: open that
 * trip.
 */
@Component({
  selector: 'app-stamp-detail-sheet',
  imports: [
    TranslocoPipe,
    MkSheetComponent,
    MkStampComponent,
    MkStackComponent,
    MkRowComponent,
    MkSectionComponent,
    MkTextComponent,
    MkListComponent,
    MkListRowComponent,
    MkButtonComponent,
  ],
  providers: [providePassportI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="data.place">
      <mk-stack gap="2" data-testid="passport.detail">
        <mk-row gap="2">
          <mk-stamp
            [code]="data.code"
            [name]="data.place"
            [isoDate]="data.isoDate"
            [arrivedBy]="data.arrivedBy"
            [reached]="data.earned"
            [pendingLabel]="'passport.comingUp' | transloco"
          />
          <mk-stack gap="half">
            <p mk-text variant="body-strong" data-testid="passport.detail.when">
              {{
                (data.earned ? 'passport.detail.stamped' : 'passport.detail.comingUp')
                  | transloco: { date: data.date }
              }}
            </p>
            <p mk-text tone="ink-2" data-testid="passport.detail.trip">
              {{ 'passport.detail.trip' | transloco: { trip: data.tripName } }}
            </p>
            @if (data.arrivedBy; as mode) {
              <p mk-text variant="caption" tone="ink-3">
                {{ 'passport.detail.arrivedBy.' + mode | transloco }}
              </p>
            }
          </mk-stack>
        </mk-row>
        @if (data.visits.length > 1) {
          <mk-section [eyebrow]="'passport.detail.visits' | transloco">
            <mk-list data-testid="passport.detail.visits">
              @for (visit of data.visits; track $index) {
                <mk-list-row
                  [title]="visit.tripName"
                  [meta]="
                    (visit.earned ? 'passport.detail.visitEarned' : 'passport.detail.visitComingUp')
                      | transloco: { date: visit.date, trip: visit.tripName }
                  "
                />
              }
            </mk-list>
          </mk-section>
        }
      </mk-stack>
      <mk-row mkSheetFooter gap="1" justify="end">
        <button mk-button variant="ghost" type="button" (click)="ref.close()">
          {{ 'passport.detail.close' | transloco }}
        </button>
        <button mk-button type="button" data-testid="passport.detail.openTrip" (click)="openTrip()">
          {{ 'passport.detail.openTrip' | transloco }}
        </button>
      </mk-row>
    </mk-sheet>
  `,
})
export class StampDetailSheet {
  protected readonly data = inject<StampDetailData>(DIALOG_DATA)
  protected readonly ref = inject<DialogRef<void>>(DialogRef)
  private readonly router = inject(Router)

  protected openTrip(): void {
    this.ref.close()
    void this.router.navigate(['/t', this.data.tripId])
  }
}
