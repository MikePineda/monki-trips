import { equalShares, scaleShares } from '@monkitrips/shared'

/** What the split sheet edits: who paid, who shares, and optional custom amounts. */
export interface SplitDraft {
  payerId: string | null
  participantIds: readonly string[]
  /** Minor units per participant; null for an equal split. */
  custom: Readonly<Record<string, number>> | null
}

export interface SplitResult {
  /** One per participant, in traveller order. */
  shares: { travellerId: string; shareMinor: number }[]
  /** `amount − Σ shares`: positive is still to assign, negative is too much. */
  remainingMinor: number
  /** Someone shares and the shares add up to the amount. */
  valid: boolean
}

/** The split a quick expense starts with: I paid, everyone shares equally. Pure. */
export function defaultSplit(travellerIds: readonly string[], meId: string | null): SplitDraft {
  return {
    payerId: meId ?? travellerIds[0] ?? null,
    participantIds: [...travellerIds],
    custom: null,
  }
}

/**
 * The shares a draft gives for `amountMinor`: an equal split (the shared
 * rule, remainder on the payer) or the custom amounts, which must add up
 * to the amount. Participants follow `travellerOrder`. Pure.
 */
export function splitShares(
  amountMinor: number,
  draft: SplitDraft,
  travellerOrder: readonly string[]
): SplitResult {
  const participants = travellerOrder.filter((id) => draft.participantIds.includes(id))
  const custom = draft.custom
  const shares = custom
    ? participants.map((travellerId) => ({ travellerId, shareMinor: custom[travellerId] ?? 0 }))
    : equalShares(amountMinor, participants, draft.payerId)
  const remainingMinor = amountMinor - shares.reduce((sum, share) => sum + share.shareMinor, 0)
  return { shares, remainingMinor, valid: participants.length > 0 && remainingMinor === 0 }
}

/**
 * The shares to save for `amountMinor`: the draft's own when they add up;
 * custom amounts made for another amount follow it in proportion (the
 * remainder on the payer); an equal split stays equal. Pure.
 */
export function sharesFor(
  amountMinor: number,
  draft: SplitDraft,
  travellerOrder: readonly string[]
): SplitResult['shares'] {
  const result = splitShares(amountMinor, draft, travellerOrder)
  if (result.valid || !draft.custom) return result.shares
  return scaleShares(amountMinor, result.shares, draft.payerId)
}
