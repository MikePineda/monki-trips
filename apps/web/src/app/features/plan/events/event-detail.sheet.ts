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
import { intlLocale } from '../../../core/i18n/intl-locale'
import { scopedLabels } from '../../../core/i18n/scoped-labels'
import { TIME_ZONE } from '../../../core/offline/time-zone'
import { liveSignalFor } from '../../../core/offline/live'
import type { EventRecord, SeatRecord, SegmentRecord } from '../../../core/offline/records'
import { TripContentStore } from '../../../core/offline/trip-content.store'
import {
  tripDocuments,
  tripRecord,
  tripStops,
  tripTravellers,
} from '../../../core/offline/trip-queries'
import { formatDayDate } from '../../../domain/day-date'
import { directionsUrl } from '../../../domain/directions-link'
import { formatMoney } from '../../../domain/money'
import { isIosUserAgent } from '../../../domain/platform'
import { localClock, localDateOf, zoneLabel } from '../../../domain/zoned-time'
import { MkButtonComponent } from '../../../shared/ui/button/button.component'
import { MkChipComponent } from '../../../shared/ui/chip/chip.component'
import { MkIconComponent } from '../../../shared/ui/icon/icon.component'
import { MkRowComponent } from '../../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../../shared/ui/list/list.component'
import { MkRouteChipComponent } from '../../../shared/ui/route-chip/route-chip.component'
import { MkSegmentedComponent } from '../../../shared/ui/segmented/segmented.component'
import { MkSheetComponent } from '../../../shared/ui/sheet/sheet.component'
import { SheetService } from '../../../shared/ui/sheet/sheet.service'
import { MkTextComponent } from '../../../shared/ui/text/text.component'
import { ToastService, TOAST_WITH_ACTION_DURATION_MS } from '../../../shared/ui/toast/toast.service'
import { EVENT_KIND_ICONS } from './event-kind-icon'
import { EventFormSheet, type EventFormData } from './event-form.sheet'
import { provideEventsI18n } from './events-i18n'

export interface EventDetailData {
  tripId: string
  eventId: string
}

interface DetailRow {
  key: string
  value: string
  mono?: boolean
}

/**
 * Everything about one event, live from the device: when (local time with
 * the zone when it differs from the device's), where, provider and booking
 * code, cost, notes, the legs with their seats, the linked documents
 * (each opens in the Docs tab), the night override, and the
 * actions: Directions (Apple Maps on iOS, Google Maps elsewhere), edit,
 * delete with undo.
 */
@Component({
  selector: 'app-event-detail-sheet',
  imports: [
    TranslocoPipe,
    MkSheetComponent,
    MkStackComponent,
    MkRowComponent,
    MkSectionComponent,
    MkTextComponent,
    MkButtonComponent,
    MkIconComponent,
    MkChipComponent,
    MkRouteChipComponent,
    MkSegmentedComponent,
    MkListComponent,
    MkListRowComponent,
  ],
  providers: [provideEventsI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="event()?.title ?? ('events.detail.title' | transloco)">
      @if (event(); as event) {
        <mk-stack gap="2" data-testid="events.detail">
          <mk-row gap="1" [wrap]="true">
            <mk-chip variant="tag" [icon]="icons[event.kind]">
              {{ 'events.kind.' + event.kind | transloco }}
            </mk-chip>
            <mk-chip variant="status" [tone]="statusTone()" data-testid="events.detail.status">
              {{ 'events.status.' + event.status | transloco }}
            </mk-chip>
            @if (event.syncState === 'pending') {
              <mk-chip variant="status" data-testid="events.detail.pending">
                {{ 'events.detail.pendingChange' | transloco }}
              </mk-chip>
            }
          </mk-row>

          <mk-section [eyebrow]="'events.detail.when' | transloco">
            @if (when(); as when) {
              <mk-stack gap="half">
                <p mk-text variant="code" data-testid="events.detail.starts">{{ when.start }}</p>
                @if (when.end) {
                  <p mk-text variant="caption" tone="ink-2">
                    {{ 'events.detail.to' | transloco }} {{ when.end }}
                  </p>
                }
              </mk-stack>
            } @else {
              <p mk-text tone="ink-3">{{ 'events.detail.noTime' | transloco }}</p>
            }
          </mk-section>

          @if (legs().length > 0) {
            <mk-section [eyebrow]="'events.detail.legs' | transloco">
              <mk-stack gap="1" data-testid="events.detail.legs">
                @for (leg of legs(); track leg.id) {
                  <mk-stack gap="half">
                    <mk-row gap="1" [wrap]="true">
                      <mk-route-chip
                        [stops]="[
                          leg.originCode ?? leg.originName ?? '',
                          leg.destCode ?? leg.destName ?? '',
                        ]"
                      />
                      @if (leg.carrier || leg.number) {
                        <span mk-text variant="code-label" tone="ink-2"
                          >{{ leg.carrier }} {{ leg.number }}</span
                        >
                      }
                    </mk-row>
                    <p mk-text variant="caption" tone="ink-2">
                      {{ clock(leg.departsLocal, leg.departsTz, leg.departsAt) }} →
                      {{ clock(leg.arrivesLocal, leg.arrivesTz, leg.arrivesAt) }}
                    </p>
                    @for (seat of seatsOf(leg); track seat.id) {
                      <p mk-text variant="caption" tone="ink-3">
                        {{ 'events.detail.seat' | transloco: { name: seat.name, seat: seat.seat } }}
                      </p>
                    }
                  </mk-stack>
                }
              </mk-stack>
            </mk-section>
          }

          @if (rows().length > 0) {
            <mk-section>
              <mk-list data-testid="events.detail.fields">
                @for (row of rows(); track row.key) {
                  <mk-list-row
                    [title]="'events.detail.' + row.key | transloco"
                    [meta]="row.value"
                    [monoMeta]="row.mono ?? false"
                    [testId]="'events.detail.' + row.key"
                  />
                }
              </mk-list>
            </mk-section>
          }

          <mk-section [eyebrow]="'events.detail.documents' | transloco">
            <div data-testid="events.detail.documents">
              @if (documents().length > 0) {
                <mk-list>
                  @for (document of documents(); track document.id) {
                    <mk-list-row
                      [title]="document.title"
                      [icon]="document.kind === 'link' ? 'link' : 'file-text'"
                      [link]="['/t', data.tripId, 'docs', document.id]"
                      testId="events.detail.document"
                    />
                  }
                </mk-list>
              } @else {
                <p mk-text variant="caption" tone="ink-3">
                  {{ 'events.detail.noDocuments' | transloco }}
                </p>
              }
            </div>
          </mk-section>

          <mk-section [eyebrow]="'events.detail.coversNight' | transloco">
            <mk-segmented
              [options]="coverOptions()"
              [value]="coverValue()"
              (valueChange)="setCover($event)"
              [label]="'events.detail.coversNight' | transloco"
              testId="events.detail.coversNight"
            />
          </mk-section>

          <mk-stack gap="1">
            @if (directions(); as href) {
              <a
                mk-button
                variant="secondary"
                size="block"
                [href]="href"
                target="_blank"
                rel="noopener"
                data-testid="events.detail.directions"
              >
                <mk-icon name="navigation" [size]="18" />
                {{ 'events.detail.directions' | transloco }}
              </a>
            }
            <button
              mk-button
              variant="secondary"
              size="block"
              type="button"
              data-testid="events.detail.edit"
              (click)="edit()"
            >
              <mk-icon name="pencil" [size]="18" />
              {{ 'events.detail.edit' | transloco }}
            </button>
            <button
              mk-button
              variant="destructive"
              size="block"
              type="button"
              data-testid="events.detail.delete"
              (click)="remove()"
            >
              <mk-icon name="trash-2" [size]="18" />
              {{ 'events.detail.delete' | transloco }}
            </button>
          </mk-stack>
        </mk-stack>
      } @else if (loaded()) {
        <p mk-text tone="ink-2" data-testid="events.detail.gone">
          {{ 'events.detail.gone' | transloco }}
        </p>
      }
    </mk-sheet>
  `,
})
export class EventDetailSheet {
  protected readonly data = inject<EventDetailData>(DIALOG_DATA)
  private readonly ref = inject<DialogRef<void>>(DialogRef)
  private readonly content = inject(TripContentStore)
  private readonly sheets = inject(SheetService)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)
  private readonly document = inject(DOCUMENT)
  private readonly deviceZone = inject(TIME_ZONE)
  private readonly locale = intlLocale()

  protected readonly icons = EVENT_KIND_ICONS
  private readonly tripId = signal(this.data.tripId)
  private readonly eventId = signal(this.data.eventId)
  private readonly trip = tripRecord(this.tripId)
  private readonly stops = tripStops(this.tripId)
  private readonly travellers = tripTravellers(this.tripId)
  private readonly loadedEvent = liveSignalFor(
    this.eventId,
    async (db, id) => ({ event: (await db.events.get(id)) ?? null }),
    null as { event: EventRecord | null } | null
  )
  protected readonly event = computed(() => this.loadedEvent()?.event ?? null)
  protected readonly loaded = computed(() => this.loadedEvent() !== null)
  protected readonly legs = liveSignalFor(
    this.eventId,
    async (db, id) =>
      (await db.segments.where('eventId').equals(id).toArray()).sort(
        (a, b) => a.position - b.position
      ),
    [] as SegmentRecord[]
  )
  private readonly seats = liveSignalFor(
    this.tripId,
    (db, id) => db.seats.where('tripId').equals(id).toArray(),
    [] as SeatRecord[]
  )

  private readonly tripDocuments = tripDocuments(this.tripId)
  protected readonly documents = computed(() =>
    this.tripDocuments().filter((document) => document.eventId === this.data.eventId)
  )

  protected readonly statusTone = computed(() => {
    const status = this.event()?.status
    if (status === 'paid' || status === 'booked') return 'good' as const
    if (status === 'cancelled') return 'critical' as const
    if (status === 'to_book') return 'warning' as const
    return 'neutral' as const
  })

  protected readonly when = computed(() => {
    const event = this.event()
    if (!event?.startsLocal || !event.startTz) {
      return null
    }
    const start = this.whenText(event.startsLocal, event.startTz, event.startsAt)
    const end = event.endsLocal
      ? this.whenText(event.endsLocal, event.endTz ?? event.startTz, event.endsAt)
      : null
    return { start, end }
  })

  protected readonly rows = computed<DetailRow[]>(() => {
    const event = this.event()
    if (!event) {
      return []
    }
    const rows: DetailRow[] = []
    if (event.placeName) rows.push({ key: 'place', value: event.placeName })
    if (event.address) rows.push({ key: 'address', value: event.address })
    if (event.addressLocal) rows.push({ key: 'addressLocal', value: event.addressLocal })
    if (event.lat !== null && event.lng !== null) {
      rows.push({ key: 'coordinates', value: `${event.lat}, ${event.lng}`, mono: true })
    }
    if (event.providerName) rows.push({ key: 'provider', value: event.providerName })
    if (event.bookingCode) rows.push({ key: 'bookingCode', value: event.bookingCode, mono: true })
    if (event.costMinor !== null && event.costCurrency) {
      rows.push({
        key: 'cost',
        value: formatMoney(event.costMinor, event.costCurrency, this.locale()),
      })
    }
    if (event.notes) rows.push({ key: 'notes', value: event.notes })
    return rows
  })

  protected readonly directions = computed(() => {
    const event = this.event()
    if (!event) {
      return null
    }
    const window = this.document.defaultView
    const ios = isIosUserAgent(
      window?.navigator.userAgent ?? '',
      window?.navigator.maxTouchPoints ?? 0
    )
    return directionsUrl(ios ? 'ios' : 'other', event)
  })

  private readonly coverLabels = scopedLabels('events', [
    'detail.coversNightAuto',
    'detail.coversNightYes',
    'detail.coversNightNo',
  ])
  protected readonly coverOptions = computed(() => {
    const labels = this.coverLabels()
    return [
      { id: 'auto', label: labels[0] ?? '' },
      { id: 'yes', label: labels[1] ?? '' },
      { id: 'no', label: labels[2] ?? '' },
    ]
  })
  protected readonly coverValue = computed(() => {
    const covers = this.event()?.coversNight
    return covers === true ? 'yes' : covers === false ? 'no' : 'auto'
  })

  protected clock(local: string, zone: string, at: string | null): string {
    const label = at ? zoneLabel(zone, Date.parse(at), this.deviceZone, this.locale()) : null
    return `${formatDayDate(localDateOf(local), this.locale())} ${localClock(local)}${label ? ` ${label}` : ''}`
  }

  protected seatsOf(leg: SegmentRecord): { id: string; name: string; seat: string }[] {
    const names = new Map(
      this.travellers().map((traveller) => [traveller.id, traveller.displayName])
    )
    return this.seats()
      .filter((seat) => seat.segmentId === leg.id && seat.seat)
      .map((seat) => ({
        id: seat.id,
        name: names.get(seat.travellerId) ?? '',
        seat: seat.seat ?? '',
      }))
  }

  protected async setCover(value: string | undefined): Promise<void> {
    const event = this.event()
    if (!event) {
      return
    }
    const coversNight = value === 'yes' ? true : value === 'no' ? false : null
    if (coversNight !== (event.coversNight ?? null)) {
      await this.content.upsert({
        tripId: this.data.tripId,
        entity: 'event',
        id: event.id,
        changes: { coversNight },
      })
    }
  }

  protected edit(): void {
    const event = this.event()
    const trip = this.trip()
    if (!event || !trip) {
      return
    }
    this.sheets.open<void, EventFormData>(EventFormSheet, {
      data: {
        tripId: this.data.tripId,
        trip,
        stops: this.stops(),
        travellers: this.travellers(),
        event,
        segments: this.legs(),
        seats: this.seats().filter((seat) => this.legs().some((leg) => leg.id === seat.segmentId)),
      },
    })
  }

  protected async remove(): Promise<void> {
    const event = this.event()
    if (!event) {
      return
    }
    const deferred = await this.content.removeWithUndo(
      { tripId: this.data.tripId, entity: 'event', id: event.id },
      TOAST_WITH_ACTION_DURATION_MS
    )
    this.toasts.showUndo(
      this.transloco.translate('events.detail.deleted'),
      () => void deferred.undo()
    )
    this.ref.close()
  }

  private whenText(local: string, zone: string, at: string | null): string {
    return this.clock(local, zone, at)
  }
}
