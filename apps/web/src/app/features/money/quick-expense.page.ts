import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  input,
} from '@angular/core'
import { Router } from '@angular/router'
import { TranslocoService } from '@jsverse/transloco'
import { OnlineStore } from '../../core/offline/online.store'
import { SheetService, type SheetRef } from '../../shared/ui/sheet/sheet.service'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { provideMoneyI18n } from './money-i18n'
import { MoneyStore } from './money.store'
import {
  QuickExpenseSheet,
  type QuickExpenseData,
  type QuickExpenseResult,
} from './quick-expense.sheet'

/**
 * `/t/:tripId/add`, the FAB's and the manifest shortcut's target: the
 * route renders nothing itself, it opens the quick expense sheet and, when
 * the sheet closes, goes back to the screen the person came from inside
 * the trip (the Money tab when they came from outside, as the shortcut
 * does). A saved expense gets a toast with undo that says when it will
 * sync.
 */
@Component({
  selector: 'app-quick-expense-page',
  providers: [provideMoneyI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export default class QuickExpensePage {
  /** Bound from the parent route's parameter. */
  readonly tripId = input.required<string>()

  private readonly sheets = inject(SheetService)
  private readonly router = inject(Router)
  private readonly store = inject(MoneyStore)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)
  private readonly online = inject(OnlineStore)
  /** Where the person was before the FAB: captured while this navigation runs. */
  private readonly from = this.router.currentNavigation()?.previousNavigation?.finalUrl ?? null
  private ref: SheetRef<QuickExpenseResult> | null = null
  private leaving = false

  constructor() {
    afterNextRender(() => this.open())
    inject(DestroyRef).onDestroy(() => {
      this.leaving = true
      this.ref?.close()
    })
  }

  private open(): void {
    const tripId = this.tripId()
    const ref = this.sheets.open<QuickExpenseResult, QuickExpenseData>(QuickExpenseSheet, {
      data: { tripId },
      label: this.transloco.translate('money.quick.title'),
    })
    this.ref = ref
    ref.closed.subscribe((result) => {
      this.ref = null
      if (result?.expense) {
        const saved = result.expense
        const key = this.online.online() ? 'money.toast.saved' : 'money.toast.savedOffline'
        this.toasts.showUndo(this.transloco.translate(key), () => void this.store.remove(saved.id))
      }
      if (!this.leaving) {
        void this.leave(tripId)
      }
    })
  }

  private leave(tripId: string): Promise<boolean> {
    const back = this.from ? this.router.serializeUrl(this.from) : null
    if (back && back.startsWith(`/t/${tripId}/`) && !back.endsWith('/add')) {
      return this.router.navigateByUrl(back, { replaceUrl: true })
    }
    return this.router.navigate(['/t', tripId, 'money'], { replaceUrl: true })
  }
}
