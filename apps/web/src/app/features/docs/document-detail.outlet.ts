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
import { SheetService, type SheetRef } from '../../shared/ui/sheet/sheet.service'
import { DocumentDetailSheet, type DocumentDetailData } from './document-detail.sheet'

/**
 * `docs/:docId`: the detail is a sheet over the list, so the route renders
 * nothing itself. It opens the sheet when it activates, goes back to
 * `docs` when the sheet closes, and closes the sheet when the route is
 * left (the back button).
 */
@Component({
  selector: 'app-document-detail-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export default class DocumentDetailOutlet {
  readonly tripId = input.required<string>()
  readonly docId = input.required<string>()

  private readonly sheets = inject(SheetService)
  private readonly router = inject(Router)
  private ref: SheetRef<void> | null = null
  private leaving = false

  constructor() {
    effect(() => {
      const data: DocumentDetailData = { tripId: this.tripId(), docId: this.docId() }
      untracked(() => this.open(data))
    })
    inject(DestroyRef).onDestroy(() => {
      this.leaving = true
      this.ref?.close()
    })
  }

  private open(data: DocumentDetailData): void {
    this.ref?.close()
    const ref = this.sheets.open<void, DocumentDetailData>(DocumentDetailSheet, { data })
    this.ref = ref
    ref.closed.subscribe(() => {
      if (this.ref === ref && !this.leaving) {
        this.ref = null
        void this.router.navigate(['/t', data.tripId, 'docs'])
      }
    })
  }
}
