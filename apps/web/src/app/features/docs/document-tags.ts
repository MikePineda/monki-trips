import { DOCUMENT_TAGS, type DocumentTag } from '@monkitrips/shared'
import type { DocumentOfflineState } from '../../domain/document-offline-state'
import type { ChipTone } from '../../shared/ui/chip/chip.component'
import type { IconName } from '../../shared/ui/icon/icon-names'

export const TAGS: readonly DocumentTag[] = DOCUMENT_TAGS

/** The icon of each requirement tag. */
export const TAG_ICONS: Record<DocumentTag, IconName> = {
  print: 'printer',
  show_on_phone: 'smartphone',
  requires_passport: 'id-card',
}

/** Icon and status tone of each offline state (always icon + word). */
export const OFFLINE_STATE_LOOK: Record<DocumentOfflineState, { icon: IconName; tone: ChipTone }> =
  {
    saved: { icon: 'circle-check', tone: 'good' },
    not_saved: { icon: 'cloud-off', tone: 'warning' },
    saving: { icon: 'loader-circle', tone: 'neutral' },
    mismatch: { icon: 'alert-triangle', tone: 'serious' },
    link: { icon: 'link', tone: 'neutral' },
  }

/** The tags in their canonical order, with `tag` added or removed. */
export function toggleTag(
  tags: readonly DocumentTag[],
  tag: DocumentTag,
  on: boolean
): DocumentTag[] {
  return TAGS.filter((candidate) => (candidate === tag ? on : tags.includes(candidate)))
}
