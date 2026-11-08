import { DOCUMENT, inject, InjectionToken } from '@angular/core'
import { browserReceiptImageDeps, downscaleReceipt } from './receipt-image'

/** Turns the picked photo into the JPEG that is sent (see `downscaleReceipt`). */
export type ReceiptDownscaler = (photo: Blob) => Promise<Blob>

export const RECEIPT_DOWNSCALER = new InjectionToken<ReceiptDownscaler>('RECEIPT_DOWNSCALER', {
  providedIn: 'root',
  factory: () => {
    const deps = browserReceiptImageDeps(inject(DOCUMENT))
    return (photo) => downscaleReceipt(photo, deps)
  },
})
