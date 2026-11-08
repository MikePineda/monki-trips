/**
 * A split carried over to a new amount, in proportion to the shares it
 * had (what "custom amounts" meant), in the expense's own minor units:
 *
 *   share_i'  = trunc(amount × share_i / Σ share)
 *   remainder = amount − Σ share_i'              → the payer, else the first person
 *
 * Shares that add up to zero split the amount equally (`equal_shares`).
 * The result always adds up to `amountMinor`; refunds scale the same way.
 * Pure; `bigint` inside.
 */
import { equalShares, type EqualShare } from './equal_shares.ts'
import { toMinor, type MinorUnits } from './minor_units.ts'

export function scaleShares(
  amountMinor: MinorUnits,
  shares: readonly { travellerId: string; shareMinor: MinorUnits }[],
  payerTravellerId: string | null
): EqualShare[] {
  const ids = shares.map((share) => share.travellerId)
  const total = shares.reduce((sum, share) => sum + toMinor(share.shareMinor), 0n)
  if (total === 0n) {
    return equalShares(amountMinor, ids, payerTravellerId)
  }
  const amount = toMinor(amountMinor)
  const scaled = shares.map((share) => (amount * toMinor(share.shareMinor)) / total)
  const remainder = amount - scaled.reduce((sum, share) => sum + share, 0n)
  const holder =
    payerTravellerId !== null && ids.includes(payerTravellerId) ? payerTravellerId : ids[0]
  return ids.map((travellerId, index) => ({
    travellerId,
    shareMinor: Number(travellerId === holder ? scaled[index]! + remainder : scaled[index]!),
  }))
}
