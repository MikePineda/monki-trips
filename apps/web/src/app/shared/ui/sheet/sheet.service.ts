import { Dialog, type DialogRef } from '@angular/cdk/dialog'
import { Overlay } from '@angular/cdk/overlay'
import type { ComponentType } from '@angular/cdk/portal'
import { Injectable, inject } from '@angular/core'
import { firstValueFrom } from 'rxjs'
import { MkConfirmSheetComponent, type ConfirmSheetData } from './confirm-sheet.component'

export interface SheetOptions<D> {
  /** Data for the sheet component (`inject(DIALOG_DATA)`). */
  data?: D
  /** Accessible name of the dialog; use the sheet's title. */
  label?: string
  /** The person must use an explicit action to leave (no Escape, no backdrop). */
  disableClose?: boolean
}

export type SheetRef<R> = DialogRef<R>

/**
 * Bottom sheets on the CDK Dialog: focus trap, `Escape` and backdrop close,
 * focus restored to the opener, one at a time stacked by the CDK. The
 * component passed in renders inside `<mk-sheet>` for the frame. Global
 * styles for the panel live in src/styles.css (`.mk-sheet-panel`).
 */
@Injectable({ providedIn: 'root' })
export class SheetService {
  private readonly dialog = inject(Dialog)
  private readonly overlay = inject(Overlay)

  open<R = unknown, D = unknown>(
    component: ComponentType<unknown>,
    options: SheetOptions<D> = {}
  ): SheetRef<R> {
    return this.dialog.open<R, D>(component, {
      data: options.data,
      ariaLabel: options.label,
      panelClass: 'mk-sheet-panel',
      backdropClass: 'mk-sheet-backdrop',
      hasBackdrop: true,
      disableClose: options.disableClose ?? false,
      ariaModal: true,
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      width: '100%',
      maxWidth: '40rem',
      positionStrategy: this.overlay.position().global().centerHorizontally().bottom('0'),
    })
  }

  /** A yes/no sheet; resolves `true` only when the person pressed the action. */
  async confirm(data: ConfirmSheetData): Promise<boolean> {
    const ref = this.open<boolean | undefined, ConfirmSheetData>(MkConfirmSheetComponent, {
      data,
      label: data.title,
    })
    return (await firstValueFrom(ref.closed)) === true
  }

  /** Closes every open sheet (route changes, sign-out). */
  closeAll(): void {
    this.dialog.closeAll()
  }
}
