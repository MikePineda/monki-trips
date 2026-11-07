import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core'
import { form, FormField, maxLength, pattern, required, submit } from '@angular/forms/signals'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import {
  EVENT_KINDS,
  EVENT_STATUSES,
  compareIsoDate,
  isTransportKind,
  minorUnitExponent,
  type EventKind,
  type EventStatus,
} from '@monkitrips/shared'
import { v7 as uuidv7 } from 'uuid'
import { fieldError } from '../../../core/forms/field-error'
import type {
  EventRecord,
  SeatRecord,
  SegmentRecord,
  StopRecord,
  TravellerRecord,
  TripRecord,
} from '../../../core/offline/records'
import { TripContentStore } from '../../../core/offline/trip-content.store'
import { localClock, localDateOf, zoneOptions } from '../../../domain/zoned-time'
import { MkButtonComponent } from '../../../shared/ui/button/button.component'
import { MkFieldComponent } from '../../../shared/ui/field/field.component'
import { MkInputDirective } from '../../../shared/ui/field/input.directive'
import { MkIconComponent } from '../../../shared/ui/icon/icon.component'
import { MkRowComponent, MkRowGrowDirective } from '../../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../../shared/ui/layout/stack.component'
import { MkSheetComponent } from '../../../shared/ui/sheet/sheet.component'
import { MkTextComponent } from '../../../shared/ui/text/text.component'
import { ToastService } from '../../../shared/ui/toast/toast.service'
import { provideEventsI18n } from './events-i18n'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CLOCK = /^\d{2}:\d{2}$/
const CURRENCY = /^[A-Za-z]{3}$/

/** What the opener may fill in before the person types (a free day, a night to cover). */
export interface EventPrefill {
  kind?: EventKind
  startDate?: string
  startTime?: string
  endDate?: string
  endTime?: string
  tz?: string
}

export interface EventFormData {
  tripId: string
  trip: TripRecord
  stops: StopRecord[]
  travellers: TravellerRecord[]
  /** The event to edit, with its legs and seats; absent for a new one. */
  event?: EventRecord
  segments?: SegmentRecord[]
  seats?: SeatRecord[]
  prefill?: EventPrefill
}

interface EventModel {
  kind: EventKind
  title: string
  status: EventStatus
  startDate: string
  startTime: string
  startTz: string
  endDate: string
  endTime: string
  /** Empty means "same as the start". */
  endTz: string
  placeName: string
  address: string
  addressLocal: string
  lat: string
  lng: string
  providerName: string
  bookingCode: string
  cost: string
  costCurrency: string
  notes: string
}

/** One leg of the form; seats are keyed by traveller id. */
export interface LegDraft {
  id: string
  isNew: boolean
  carrier: string
  number: string
  originCode: string
  originName: string
  destCode: string
  destName: string
  departsDate: string
  departsTime: string
  departsTz: string
  arrivesDate: string
  arrivesTime: string
  arrivesTz: string
  seats: Record<string, string>
}

type LegField = Exclude<keyof LegDraft, 'id' | 'isNew' | 'seats'>

/**
 * Add or edit an itinerary event in a bottom sheet: kind, title, status,
 * local date and time with the place's zone (defaulting to the zone of the
 * stop the date belongs to), an optional end, place and address, provider
 * and booking code, cost with its currency, notes; for a flight or train,
 * the legs with per-traveller seats. Saving writes the device copy and
 * queues the mutations, one per row that changed.
 */
@Component({
  selector: 'app-event-form-sheet',
  imports: [
    TranslocoPipe,
    FormField,
    MkSheetComponent,
    MkFieldComponent,
    MkButtonComponent,
    MkInputDirective,
    MkIconComponent,
    MkStackComponent,
    MkRowComponent,
    MkRowGrowDirective,
    MkSectionComponent,
    MkTextComponent,
  ],
  providers: [provideEventsI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="(data.event ? 'events.form.editTitle' : 'events.form.newTitle') | transloco">
      <form novalidate (submit)="save($event)">
        <mk-stack gap="2">
          <mk-row gap="2" align="start">
            <mk-field mkRowGrow [label]="'events.form.kind' | transloco" [required]="true">
              <select mkInput [formField]="form.kind" data-testid="events.form.kind">
                @for (kind of kinds; track kind) {
                  <option [value]="kind">{{ 'events.kind.' + kind | transloco }}</option>
                }
              </select>
            </mk-field>
            <mk-field mkRowGrow [label]="'events.form.status' | transloco" [required]="true">
              <select mkInput [formField]="form.status" data-testid="events.form.status">
                @for (status of statuses; track status) {
                  <option [value]="status">{{ 'events.status.' + status | transloco }}</option>
                }
              </select>
            </mk-field>
          </mk-row>
          <mk-field
            [label]="'events.form.title' | transloco"
            [required]="true"
            [error]="fieldError(form.title)"
          >
            <input mkInput type="text" [formField]="form.title" data-testid="events.form.title" />
          </mk-field>

          @if (!hasLegs()) {
            <mk-row gap="2" align="start">
              <mk-field
                mkRowGrow
                [label]="
                  (lodging() ? 'events.form.checkInDate' : 'events.form.startDate') | transloco
                "
                [error]="fieldError(form.startDate)"
              >
                <input
                  mkInput
                  type="date"
                  [formField]="form.startDate"
                  data-testid="events.form.startDate"
                />
              </mk-field>
              <mk-field
                mkRowGrow
                [label]="'events.form.startTime' | transloco"
                [error]="fieldError(form.startTime) ?? timeError()"
              >
                <input
                  mkInput
                  type="time"
                  [formField]="form.startTime"
                  data-testid="events.form.startTime"
                />
              </mk-field>
            </mk-row>
            <mk-field [label]="'events.form.startTz' | transloco" [required]="true">
              <select
                mkInput
                [formField]="form.startTz"
                data-testid="events.form.startTz"
                (change)="zoneTouched.set(true)"
              >
                @for (zone of zones; track zone) {
                  <option [value]="zone">{{ zone }}</option>
                }
              </select>
            </mk-field>
            <mk-row gap="2" align="start">
              <mk-field
                mkRowGrow
                [label]="
                  (lodging() ? 'events.form.checkOutDate' : 'events.form.endDate') | transloco
                "
                [error]="fieldError(form.endDate)"
              >
                <input
                  mkInput
                  type="date"
                  [formField]="form.endDate"
                  data-testid="events.form.endDate"
                />
              </mk-field>
              <mk-field
                mkRowGrow
                [label]="'events.form.endTime' | transloco"
                [error]="fieldError(form.endTime)"
              >
                <input
                  mkInput
                  type="time"
                  [formField]="form.endTime"
                  data-testid="events.form.endTime"
                />
              </mk-field>
            </mk-row>
            <mk-field [label]="'events.form.endTz' | transloco">
              <select mkInput [formField]="form.endTz" data-testid="events.form.endTz">
                <option value="">{{ 'events.form.sameZone' | transloco }}</option>
                @for (zone of zones; track zone) {
                  <option [value]="zone">{{ zone }}</option>
                }
              </select>
            </mk-field>
          }

          @if (transport()) {
            <mk-section [eyebrow]="'events.form.legs' | transloco">
              <mk-stack gap="2">
                <p mk-text variant="caption" tone="ink-3">
                  {{ 'events.form.legsBody' | transloco }}
                </p>
                @for (leg of legs(); track leg.id; let index = $index) {
                  <mk-stack gap="1" [attr.data-testid]="'events.form.leg'">
                    <mk-row gap="2" justify="between">
                      <p mk-text variant="body-strong">
                        {{ 'events.form.leg' | transloco: { number: index + 1 } }}
                      </p>
                      <button
                        mk-button
                        variant="ghost"
                        size="sm"
                        type="button"
                        data-testid="events.form.removeLeg"
                        (click)="removeLeg(index)"
                      >
                        <mk-icon name="trash-2" [size]="16" />
                        {{ 'events.form.removeLeg' | transloco }}
                      </button>
                    </mk-row>
                    <mk-row gap="2" align="start">
                      <mk-field mkRowGrow [label]="'events.form.carrier' | transloco">
                        <input
                          mkInput
                          type="text"
                          [value]="leg.carrier"
                          (input)="setLeg(index, 'carrier', $event)"
                          data-testid="events.form.leg.carrier"
                        />
                      </mk-field>
                      <mk-field mkRowGrow [label]="'events.form.number' | transloco">
                        <input
                          mkInput
                          variant="code"
                          type="text"
                          [value]="leg.number"
                          (input)="setLeg(index, 'number', $event)"
                          data-testid="events.form.leg.number"
                        />
                      </mk-field>
                    </mk-row>
                    <mk-row gap="2" align="start">
                      <mk-field mkRowGrow [label]="'events.form.originCode' | transloco">
                        <input
                          mkInput
                          variant="code"
                          type="text"
                          autocapitalize="characters"
                          [value]="leg.originCode"
                          (input)="setLeg(index, 'originCode', $event)"
                          data-testid="events.form.leg.originCode"
                        />
                      </mk-field>
                      <mk-field mkRowGrow [label]="'events.form.originName' | transloco">
                        <input
                          mkInput
                          type="text"
                          [value]="leg.originName"
                          (input)="setLeg(index, 'originName', $event)"
                          data-testid="events.form.leg.originName"
                        />
                      </mk-field>
                    </mk-row>
                    <mk-row gap="2" align="start">
                      <mk-field
                        mkRowGrow
                        [label]="'events.form.departs' | transloco"
                        [required]="true"
                      >
                        <input
                          mkInput
                          type="date"
                          [value]="leg.departsDate"
                          (input)="setLeg(index, 'departsDate', $event)"
                          data-testid="events.form.leg.departsDate"
                        />
                      </mk-field>
                      <mk-field
                        mkRowGrow
                        [label]="'events.form.startTime' | transloco"
                        [required]="true"
                      >
                        <input
                          mkInput
                          type="time"
                          [value]="leg.departsTime"
                          (input)="setLeg(index, 'departsTime', $event)"
                          data-testid="events.form.leg.departsTime"
                        />
                      </mk-field>
                    </mk-row>
                    <mk-field [label]="'events.form.departsTz' | transloco" [required]="true">
                      <select
                        mkInput
                        [value]="leg.departsTz"
                        (change)="setLeg(index, 'departsTz', $event)"
                        data-testid="events.form.leg.departsTz"
                      >
                        @for (zone of zones; track zone) {
                          <option [value]="zone" [selected]="zone === leg.departsTz">
                            {{ zone }}
                          </option>
                        }
                      </select>
                    </mk-field>
                    <mk-row gap="2" align="start">
                      <mk-field mkRowGrow [label]="'events.form.destCode' | transloco">
                        <input
                          mkInput
                          variant="code"
                          type="text"
                          autocapitalize="characters"
                          [value]="leg.destCode"
                          (input)="setLeg(index, 'destCode', $event)"
                          data-testid="events.form.leg.destCode"
                        />
                      </mk-field>
                      <mk-field mkRowGrow [label]="'events.form.destName' | transloco">
                        <input
                          mkInput
                          type="text"
                          [value]="leg.destName"
                          (input)="setLeg(index, 'destName', $event)"
                          data-testid="events.form.leg.destName"
                        />
                      </mk-field>
                    </mk-row>
                    <mk-row gap="2" align="start">
                      <mk-field
                        mkRowGrow
                        [label]="'events.form.arrives' | transloco"
                        [required]="true"
                      >
                        <input
                          mkInput
                          type="date"
                          [value]="leg.arrivesDate"
                          (input)="setLeg(index, 'arrivesDate', $event)"
                          data-testid="events.form.leg.arrivesDate"
                        />
                      </mk-field>
                      <mk-field
                        mkRowGrow
                        [label]="'events.form.startTime' | transloco"
                        [required]="true"
                      >
                        <input
                          mkInput
                          type="time"
                          [value]="leg.arrivesTime"
                          (input)="setLeg(index, 'arrivesTime', $event)"
                          data-testid="events.form.leg.arrivesTime"
                        />
                      </mk-field>
                    </mk-row>
                    <mk-field [label]="'events.form.arrivesTz' | transloco" [required]="true">
                      <select
                        mkInput
                        [value]="leg.arrivesTz"
                        (change)="setLeg(index, 'arrivesTz', $event)"
                        data-testid="events.form.leg.arrivesTz"
                      >
                        @for (zone of zones; track zone) {
                          <option [value]="zone" [selected]="zone === leg.arrivesTz">
                            {{ zone }}
                          </option>
                        }
                      </select>
                    </mk-field>
                    @if (data.travellers.length > 0) {
                      <mk-row gap="2" align="start" [wrap]="true">
                        @for (traveller of data.travellers; track traveller.id) {
                          <mk-field
                            mkRowGrow
                            [label]="
                              'events.form.seatOf' | transloco: { name: traveller.displayName }
                            "
                          >
                            <input
                              mkInput
                              variant="code"
                              type="text"
                              [value]="leg.seats[traveller.id] ?? ''"
                              (input)="setSeat(index, traveller.id, $event)"
                              data-testid="events.form.leg.seat"
                            />
                          </mk-field>
                        }
                      </mk-row>
                    }
                  </mk-stack>
                }
                @if (legError(); as error) {
                  <p mk-text variant="caption" tone="status-critical" role="alert">
                    {{ error | transloco }}
                  </p>
                }
                <mk-row justify="end">
                  <button
                    mk-button
                    variant="secondary"
                    size="sm"
                    type="button"
                    data-testid="events.form.addLeg"
                    (click)="addLeg()"
                  >
                    <mk-icon name="plus" [size]="18" />
                    {{ 'events.form.addLeg' | transloco }}
                  </button>
                </mk-row>
              </mk-stack>
            </mk-section>
          }

          <mk-section [eyebrow]="'events.form.place' | transloco">
            <mk-stack gap="2">
              <mk-field [label]="'events.form.place' | transloco">
                <input
                  mkInput
                  type="text"
                  [formField]="form.placeName"
                  data-testid="events.form.placeName"
                />
              </mk-field>
              <mk-field [label]="'events.form.address' | transloco">
                <input
                  mkInput
                  type="text"
                  [formField]="form.address"
                  data-testid="events.form.address"
                />
              </mk-field>
              <mk-field [label]="'events.form.addressLocal' | transloco">
                <input
                  mkInput
                  type="text"
                  [formField]="form.addressLocal"
                  data-testid="events.form.addressLocal"
                />
              </mk-field>
              <mk-row gap="2" align="start">
                <mk-field
                  mkRowGrow
                  [label]="'events.form.lat' | transloco"
                  [error]="fieldError(form.lat)"
                >
                  <input
                    mkInput
                    type="number"
                    inputmode="decimal"
                    step="any"
                    [formField]="form.lat"
                    data-testid="events.form.lat"
                  />
                </mk-field>
                <mk-field
                  mkRowGrow
                  [label]="'events.form.lng' | transloco"
                  [error]="fieldError(form.lng)"
                >
                  <input
                    mkInput
                    type="number"
                    inputmode="decimal"
                    step="any"
                    [formField]="form.lng"
                    data-testid="events.form.lng"
                  />
                </mk-field>
              </mk-row>
            </mk-stack>
          </mk-section>

          <mk-section [eyebrow]="'events.form.provider' | transloco">
            <mk-stack gap="2">
              <mk-row gap="2" align="start">
                <mk-field mkRowGrow [label]="'events.form.provider' | transloco">
                  <input
                    mkInput
                    type="text"
                    [formField]="form.providerName"
                    data-testid="events.form.providerName"
                  />
                </mk-field>
                <mk-field mkRowGrow [label]="'events.form.bookingCode' | transloco">
                  <input
                    mkInput
                    variant="code"
                    type="text"
                    autocapitalize="characters"
                    [formField]="form.bookingCode"
                    data-testid="events.form.bookingCode"
                  />
                </mk-field>
              </mk-row>
              <mk-row gap="2" align="start">
                <mk-field
                  mkRowGrow
                  [label]="'events.form.cost' | transloco"
                  [error]="fieldError(form.cost)"
                >
                  <input
                    mkInput
                    type="number"
                    inputmode="decimal"
                    step="any"
                    [formField]="form.cost"
                    data-testid="events.form.cost"
                  />
                </mk-field>
                <mk-field
                  mkRowGrow
                  [label]="'events.form.costCurrency' | transloco"
                  [error]="fieldError(form.costCurrency) ?? costError()"
                >
                  <input
                    mkInput
                    variant="code"
                    type="text"
                    autocapitalize="characters"
                    [formField]="form.costCurrency"
                    data-testid="events.form.costCurrency"
                  />
                </mk-field>
              </mk-row>
              <mk-field [label]="'events.form.notes' | transloco">
                <textarea
                  mkInput
                  rows="3"
                  [formField]="form.notes"
                  data-testid="events.form.notes"
                ></textarea>
              </mk-field>
            </mk-stack>
          </mk-section>

          <button mk-button size="block" type="submit" data-testid="events.form.submit">
            {{ 'events.form.save' | transloco }}
          </button>
        </mk-stack>
      </form>
    </mk-sheet>
  `,
})
export class EventFormSheet {
  protected readonly data = inject<EventFormData>(DIALOG_DATA)
  private readonly ref = inject<DialogRef<void>>(DialogRef)
  private readonly content = inject(TripContentStore)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)

  protected readonly kinds = EVENT_KINDS
  protected readonly statuses = EVENT_STATUSES
  protected readonly fieldError = fieldError
  protected readonly zones = zoneOptions(this.data.event?.startTz ?? this.data.prefill?.tz)
  /** Once the person picked a zone, the stop's zone stops following the date. */
  protected readonly zoneTouched = signal(this.data.event !== undefined)

  protected readonly model = signal<EventModel>(initialModel(this.data))
  protected readonly legs = signal<LegDraft[]>(initialLegs(this.data))
  protected readonly legError = signal<string | null>(null)
  protected readonly timeError = signal<{ kind: string; message: string } | null>(null)
  protected readonly costError = signal<{ kind: string; message: string } | null>(null)

  protected readonly form = form(this.model, (path) => {
    required(path.title)
    maxLength(path.title, 200)
    pattern(path.startDate, ISO_DATE)
    pattern(path.startTime, CLOCK)
    required(path.startTz)
    pattern(path.endDate, ISO_DATE)
    pattern(path.endTime, CLOCK)
    pattern(path.costCurrency, CURRENCY)
    maxLength(path.bookingCode, 100)
  })

  protected readonly transport = computed(() => isTransportKind(this.model().kind))
  protected readonly lodging = computed(() => this.model().kind === 'lodging')
  protected readonly hasLegs = computed(() => this.transport() && this.legs().length > 0)

  constructor() {
    // A new event takes the zone of the stop its date falls in, until the person picks one.
    effect(() => {
      const date = this.model().startDate
      if (untracked(this.zoneTouched)) {
        return
      }
      const zone = zoneForDate(this.data, date)
      if (zone && zone !== untracked(() => this.model().startTz)) {
        untracked(() => this.model.update((model) => ({ ...model, startTz: zone })))
      }
    })
  }

  protected addLeg(): void {
    const model = this.model()
    const previous = this.legs().at(-1)
    this.legs.update((legs) => [
      ...legs,
      {
        id: uuidv7(),
        isNew: true,
        carrier: previous?.carrier ?? model.providerName,
        number: '',
        originCode: previous?.destCode ?? '',
        originName: previous?.destName ?? '',
        destCode: '',
        destName: '',
        departsDate: previous?.arrivesDate ?? model.startDate,
        departsTime: previous ? '' : model.startTime,
        departsTz: previous?.arrivesTz ?? model.startTz,
        arrivesDate: previous?.arrivesDate ?? model.startDate,
        arrivesTime: '',
        arrivesTz: previous?.arrivesTz ?? model.startTz,
        seats: {},
      },
    ])
  }

  protected removeLeg(index: number): void {
    this.legs.update((legs) => legs.filter((_, position) => position !== index))
  }

  protected setLeg(index: number, field: LegField, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value
    this.legs.update((legs) =>
      legs.map((leg, position) => (position === index ? { ...leg, [field]: value } : leg))
    )
  }

  protected setSeat(index: number, travellerId: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value
    this.legs.update((legs) =>
      legs.map((leg, position) =>
        position === index ? { ...leg, seats: { ...leg.seats, [travellerId]: value } } : leg
      )
    )
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault()
    this.timeError.set(null)
    this.costError.set(null)
    this.legError.set(null)
    await submit(this.form, async () => {
      const model = this.model()
      const legs = this.transport() ? this.legs() : []
      if (model.startDate && !model.startTime) {
        this.timeError.set({
          kind: 'custom',
          message: this.transloco.translate('events.form.timeRequired'),
        })
        return undefined
      }
      if (model.cost.trim() !== '' && !model.costCurrency) {
        this.costError.set({
          kind: 'custom',
          message: this.transloco.translate('events.form.costNeedsCurrency'),
        })
        return undefined
      }
      for (const leg of legs) {
        if (!leg.departsDate || !leg.departsTime || !leg.arrivesDate || !leg.arrivesTime) {
          this.legError.set('events.form.legTimesRequired')
          return undefined
        }
        if (`${leg.arrivesDate}T${leg.arrivesTime}` < `${leg.departsDate}T${leg.departsTime}`) {
          this.legError.set('events.form.legOrder')
          return undefined
        }
      }
      await this.persist(model, legs)
      this.toasts.show({ message: this.transloco.translate('events.form.saved') })
      this.ref.close()
      return undefined
    })
  }

  private async persist(model: EventModel, legs: LegDraft[]): Promise<void> {
    const existing = this.data.event
    const eventId = existing?.id ?? uuidv7()
    const currency = model.costCurrency.trim().toUpperCase()
    const wanted: Record<string, unknown> = {
      kind: model.kind,
      title: model.title.trim(),
      status: model.status,
      startsLocal: legs.length > 0 ? undefined : local(model.startDate, model.startTime),
      startTz: legs.length > 0 ? undefined : model.startTz,
      endsLocal: legs.length > 0 ? undefined : local(model.endDate, model.endTime),
      endTz: legs.length > 0 ? undefined : model.endTz || null,
      placeName: text(model.placeName),
      address: text(model.address),
      addressLocal: text(model.addressLocal),
      lat: number(model.lat),
      lng: number(model.lng),
      providerName: text(model.providerName),
      bookingCode: text(model.bookingCode)?.toUpperCase() ?? null,
      costMinor: currency ? minor(model.cost, currency) : null,
      costCurrency: currency ? currency : null,
      notes: text(model.notes),
    }
    const changes: Record<string, unknown> = {}
    for (const [field, value] of Object.entries(wanted)) {
      if (value === undefined) {
        continue
      }
      const before = existing ? (existing as unknown as Record<string, unknown>)[field] : undefined
      if (!existing ? value !== null : before !== value) {
        changes[field] = value
      }
    }
    if (!existing || Object.keys(changes).length > 0) {
      await this.content.upsert({ tripId: this.data.tripId, entity: 'event', id: eventId, changes })
    }
    await this.persistLegs(eventId, legs)
  }

  private async persistLegs(eventId: string, legs: LegDraft[]): Promise<void> {
    const before = new Map((this.data.segments ?? []).map((segment) => [segment.id, segment]))
    const seatsBefore = this.data.seats ?? []
    for (const [index, leg] of legs.entries()) {
      const previous = before.get(leg.id)
      before.delete(leg.id)
      const wanted: Record<string, unknown> = {
        eventId,
        position: index + 1,
        carrier: text(leg.carrier),
        number: text(leg.number),
        originCode: text(leg.originCode)?.toUpperCase() ?? null,
        originName: text(leg.originName),
        destCode: text(leg.destCode)?.toUpperCase() ?? null,
        destName: text(leg.destName),
        departsLocal: `${leg.departsDate}T${leg.departsTime}`,
        departsTz: leg.departsTz,
        arrivesLocal: `${leg.arrivesDate}T${leg.arrivesTime}`,
        arrivesTz: leg.arrivesTz,
      }
      const changes: Record<string, unknown> = {}
      for (const [field, value] of Object.entries(wanted)) {
        const old = previous ? (previous as unknown as Record<string, unknown>)[field] : undefined
        if (!previous ? value !== null : old !== value) {
          changes[field] = value
        }
      }
      if (!previous || Object.keys(changes).length > 0) {
        await this.content.upsert({
          tripId: this.data.tripId,
          entity: 'segment',
          id: leg.id,
          changes,
        })
      }
      for (const traveller of this.data.travellers) {
        const seat = text(leg.seats[traveller.id] ?? '')?.toUpperCase() ?? null
        const row = seatsBefore.find(
          (candidate) => candidate.segmentId === leg.id && candidate.travellerId === traveller.id
        )
        if (seat === null) {
          if (row) {
            await this.content.remove({ tripId: this.data.tripId, entity: 'seat', id: row.id })
          }
        } else if (!row) {
          await this.content.upsert({
            tripId: this.data.tripId,
            entity: 'seat',
            id: uuidv7(),
            changes: { segmentId: leg.id, travellerId: traveller.id, seat },
          })
        } else if (row.seat !== seat) {
          await this.content.upsert({
            tripId: this.data.tripId,
            entity: 'seat',
            id: row.id,
            changes: { seat },
          })
        }
      }
    }
    for (const removed of before.keys()) {
      await this.content.remove({ tripId: this.data.tripId, entity: 'segment', id: removed })
    }
  }
}

function initialModel(data: EventFormData): EventModel {
  const event = data.event
  const prefill = data.prefill ?? {}
  const kind = event?.kind ?? prefill.kind ?? 'activity'
  const startDate = event?.startsLocal ? localDateOf(event.startsLocal) : (prefill.startDate ?? '')
  const startTz =
    event?.startTz ?? prefill.tz ?? zoneForDate(data, startDate) ?? data.trip.homeTz ?? 'UTC'
  return {
    kind,
    title: event?.title ?? '',
    status: event?.status ?? 'to_book',
    startDate,
    startTime: event?.startsLocal ? localClock(event.startsLocal) : (prefill.startTime ?? ''),
    startTz,
    endDate: event?.endsLocal ? localDateOf(event.endsLocal) : (prefill.endDate ?? ''),
    endTime: event?.endsLocal ? localClock(event.endsLocal) : (prefill.endTime ?? ''),
    endTz: event?.endTz && event.endTz !== event.startTz ? event.endTz : '',
    placeName: event?.placeName ?? '',
    address: event?.address ?? '',
    addressLocal: event?.addressLocal ?? '',
    lat: event?.lat === null || event?.lat === undefined ? '' : String(event.lat),
    lng: event?.lng === null || event?.lng === undefined ? '' : String(event.lng),
    providerName: event?.providerName ?? '',
    bookingCode: event?.bookingCode ?? '',
    cost:
      event?.costMinor === null || event?.costMinor === undefined || !event.costCurrency
        ? ''
        : major(event.costMinor, event.costCurrency),
    costCurrency: event?.costCurrency ?? '',
    notes: event?.notes ?? '',
  }
}

function initialLegs(data: EventFormData): LegDraft[] {
  return [...(data.segments ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((segment) => ({
      id: segment.id,
      isNew: false,
      carrier: segment.carrier ?? '',
      number: segment.number ?? '',
      originCode: segment.originCode ?? '',
      originName: segment.originName ?? '',
      destCode: segment.destCode ?? '',
      destName: segment.destName ?? '',
      departsDate: localDateOf(segment.departsLocal),
      departsTime: localClock(segment.departsLocal),
      departsTz: segment.departsTz,
      arrivesDate: localDateOf(segment.arrivesLocal),
      arrivesTime: localClock(segment.arrivesLocal),
      arrivesTz: segment.arrivesTz,
      seats: Object.fromEntries(
        (data.seats ?? [])
          .filter((seat) => seat.segmentId === segment.id)
          .map((seat) => [seat.travellerId, seat.seat ?? ''])
      ),
    }))
}

/** The zone of the stop a date falls in (the last one that covers it), if any. */
function zoneForDate(data: EventFormData, date: string): string | null {
  if (!ISO_DATE.test(date)) {
    return null
  }
  const stop = [...data.stops]
    .sort((a, b) => a.position - b.position)
    .filter(
      (candidate) =>
        candidate.tz &&
        candidate.arriveOn &&
        candidate.departOn &&
        compareIsoDate(candidate.arriveOn, date) <= 0 &&
        compareIsoDate(date, candidate.departOn) <= 0
    )
    .at(-1)
  return stop?.tz ?? null
}

function local(date: string, time: string): string | null {
  return date && time ? `${date}T${time}` : null
}

function text(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function number(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function minor(value: string, currency: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }
  const { exponent } = minorUnitExponent(currency)
  return Math.round(Number(trimmed) * 10 ** exponent)
}

function major(minorUnits: number, currency: string): string {
  const { exponent } = minorUnitExponent(currency)
  return (minorUnits / 10 ** exponent).toFixed(exponent)
}
