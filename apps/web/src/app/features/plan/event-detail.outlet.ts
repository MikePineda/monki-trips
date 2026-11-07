import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core'
import { Router } from '@angular/router'
import type { SheetRef } from '../../shared/ui/sheet/sheet.service'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { EventDetailSheet, type EventDetailData } from './events/event-detail.sheet'

/**
 * `plan/e/:eventId`: the event detail is a sheet over the Days list, so
 * the route renders nothing itself. It opens the sheet when it activates,
 * returns to `plan` when the sheet closes, and closes the sheet when the
 * route is left (the back button).
 */
@Component({
  selector: 'app-event-detail-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export default class EventDetailOutlet {
  readonly tripId = input.required<string>()
  readonly eventId = input.required<string>()

  private readonly sheets = inject(SheetService)
  private readonly router = inject(Router)
  private readonly destroyRef = inject(DestroyRef)
  private ref: SheetRef<void> | null = null
  private leaving = false

  constructor() {
    effect(() => {
      const data: EventDetailData = { tripId: this.tripId(), eventId: this.eventId() }
      untracked(() => this.open(data))
    })
    this.destroyRef.onDestroy(() => {
      this.leaving = true
      this.ref?.close()
    })
  }

  private open(data: EventDetailData): void {
    this.ref?.close()
    const ref = this.sheets.open<void, EventDetailData>(EventDetailSheet, { data })
    this.ref = ref
    ref.closed.subscribe(() => {
      if (this.ref === ref && !this.leaving) {
        this.ref = null
        void this.router.navigate(['/t', data.tripId, 'plan'])
      }
    })
  }
}
