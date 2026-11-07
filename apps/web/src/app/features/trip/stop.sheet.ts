import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import {
  form,
  FormField,
  maxLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { v7 as uuidv7 } from 'uuid'
import { fieldError } from '../../core/forms/field-error'
import type { StopRecord } from '../../core/offline/records'
import { TripContentStore } from '../../core/offline/trip-content.store'
import { zoneOptions } from '../../domain/zoned-time'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkRowComponent, MkRowGrowDirective } from '../../shared/ui/layout/row.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { provideTripI18n } from './trip-i18n'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const COUNTRY = /^[A-Za-z]{2}$/

export interface StopSheetData {
  tripId: string
  /** The stop to edit; absent for a new one. */
  stop?: StopRecord
  /** Zone proposed for a new stop (the previous stop's, else the trip's home zone). */
  defaultTz: string
  /** Position a new stop takes (after the last one). */
  nextPosition: number
}

interface StopModel {
  name: string
  countryCode: string
  tz: string
  arriveOn: string
  departOn: string
}

/**
 * One stop of the trip (a place you stay in): name, country, time zone
 * and dates. Saves through the outbox; deleting puts a toast with undo.
 */
@Component({
  selector: 'app-stop-sheet',
  imports: [
    TranslocoPipe,
    FormField,
    MkSheetComponent,
    MkFieldComponent,
    MkButtonComponent,
    MkInputDirective,
    MkStackComponent,
    MkRowComponent,
    MkRowGrowDirective,
  ],
  providers: [provideTripI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="(data.stop ? 'trip.stop.editTitle' : 'trip.stop.newTitle') | transloco">
      <form novalidate (submit)="save($event)">
        <mk-stack gap="2">
          <mk-field
            [label]="'trip.stop.name' | transloco"
            [required]="true"
            [error]="fieldError(form.name)"
          >
            <input mkInput type="text" [formField]="form.name" data-testid="trip.stop.name" />
          </mk-field>
          <mk-row gap="2" align="start">
            <mk-field
              mkRowGrow
              [label]="'trip.stop.country' | transloco"
              [hint]="'trip.stop.countryHint' | transloco"
              [error]="fieldError(form.countryCode)"
            >
              <input
                mkInput
                variant="code"
                type="text"
                autocapitalize="characters"
                [formField]="form.countryCode"
                data-testid="trip.stop.country"
              />
            </mk-field>
            <mk-field mkRowGrow [label]="'trip.stop.tz' | transloco" [required]="true">
              <select mkInput [formField]="form.tz" data-testid="trip.stop.tz">
                @for (zone of zones; track zone) {
                  <option [value]="zone">{{ zone }}</option>
                }
              </select>
            </mk-field>
          </mk-row>
          <mk-row gap="2" align="start">
            <mk-field
              mkRowGrow
              [label]="'trip.stop.arriveOn' | transloco"
              [error]="fieldError(form.arriveOn)"
            >
              <input
                mkInput
                type="date"
                [formField]="form.arriveOn"
                data-testid="trip.stop.arriveOn"
              />
            </mk-field>
            <mk-field
              mkRowGrow
              [label]="'trip.stop.departOn' | transloco"
              [error]="fieldError(form.departOn)"
            >
              <input
                mkInput
                type="date"
                [formField]="form.departOn"
                data-testid="trip.stop.departOn"
              />
            </mk-field>
          </mk-row>
          <button mk-button size="block" type="submit" data-testid="trip.stop.submit">
            {{ 'trip.stop.save' | transloco }}
          </button>
          @if (data.stop) {
            <button
              mk-button
              variant="destructive"
              size="block"
              type="button"
              data-testid="trip.stop.delete"
              (click)="remove()"
            >
              {{ 'trip.stop.delete' | transloco }}
            </button>
          }
        </mk-stack>
      </form>
    </mk-sheet>
  `,
})
export class StopSheet {
  protected readonly data = inject<StopSheetData>(DIALOG_DATA)
  private readonly ref = inject<DialogRef<void>>(DialogRef)
  private readonly content = inject(TripContentStore)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)

  protected readonly fieldError = fieldError
  protected readonly zones = zoneOptions(this.data.stop?.tz ?? this.data.defaultTz)
  protected readonly model = signal<StopModel>({
    name: this.data.stop?.name ?? '',
    countryCode: this.data.stop?.countryCode ?? '',
    tz: this.data.stop?.tz ?? this.data.defaultTz,
    arriveOn: this.data.stop?.arriveOn ?? '',
    departOn: this.data.stop?.departOn ?? '',
  })
  protected readonly form = form(this.model, (path) => {
    required(path.name)
    maxLength(path.name, 200)
    pattern(path.countryCode, COUNTRY)
    required(path.tz)
    pattern(path.arriveOn, ISO_DATE)
    pattern(path.departOn, ISO_DATE)
    validate(path.departOn, ({ value, valueOf }) =>
      value() && valueOf(path.arriveOn) && value() < valueOf(path.arriveOn)
        ? { kind: 'endsBeforeStart' }
        : undefined
    )
  })

  protected async save(event: Event): Promise<void> {
    event.preventDefault()
    await submit(this.form, async () => {
      const next = this.model()
      const stop = this.data.stop
      const wanted = {
        name: next.name.trim(),
        countryCode: next.countryCode ? next.countryCode.toUpperCase() : null,
        tz: next.tz,
        arriveOn: next.arriveOn || null,
        departOn: next.departOn || null,
      }
      const changes: Record<string, unknown> = {}
      for (const [field, value] of Object.entries(wanted)) {
        if (!stop || (stop as unknown as Record<string, unknown>)[field] !== value) {
          changes[field] = value
        }
      }
      if (!stop) {
        changes['position'] = this.data.nextPosition
      }
      if (Object.keys(changes).length > 0) {
        await this.content.upsert({
          tripId: this.data.tripId,
          entity: 'stop',
          id: stop?.id ?? uuidv7(),
          changes,
        })
      }
      this.ref.close()
      return undefined
    })
  }

  protected async remove(): Promise<void> {
    const stop = this.data.stop
    if (!stop) {
      return
    }
    const deferred = await this.content.removeWithUndo(
      { tripId: this.data.tripId, entity: 'stop', id: stop.id },
      8000
    )
    this.toasts.showUndo(this.transloco.translate('trip.stop.deleted'), () => void deferred.undo())
    this.ref.close()
  }
}
