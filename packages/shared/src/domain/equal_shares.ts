/**
 * An amount split equally between participants, in the expense's own
 * minor units, so the shares always add up to the amount:
 *
 *   share_i   = trunc(amount / n)
 *   remainder = amount − n × share_i      (|remainder| < n)
 *
 * The whole remainder goes to the payer when the payer is one of the
 * participants, otherwise to the first participant. A refund (negative
 * amount) splits into negative shares the same way. Pure.
 */
import { toMinor, type MinorUnits } from './minor_units.ts'

export interface EqualShare {
  travellerId: string
  shareMinor: number
}

export function equalShares(
  amountMinor: MinorUnits,
  travellerIds: readonly string[],
  payerTravellerId: string | null
): EqualShare[] {
  if (travellerIds.length === 0) {
    return []
  }
  const amount = toMinor(amountMinor)
  const count = BigInt(travellerIds.length)
  const each = amount / count
  const remainder = amount - each * count
  const holder =
    payerTravellerId !== null && travellerIds.includes(payerTravellerId)
      ? payerTravellerId
      : travellerIds[0]
  return travellerIds.map((travellerId) => ({
    travellerId,
    shareMinor: Number(travellerId === holder ? each + remainder : each),
  }))
}
