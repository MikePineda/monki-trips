/**
 * Who owes whom on a trip in split mode, in base minor units.
 *
 * For every expense with a base amount `X` paid by `p` and shares `s_i` in
 * the expense's own currency (Σ s_i = amount):
 *
 *   owed_i    = trunc(X × s_i / amount)            for every share
 *   owed_p   += X − Σ owed_i                       (the rounding remainder goes to the payer)
 *   paid_p   += X
 *   net_t     = paid_t − owed_t                    (positive: the others owe t)
 *
 * Σ net_t is always 0. An expense without shares is split equally among
 * every traveller given (`equal_shares`). An expense without a payer uses
 * `defaultPayerTravellerId` (what the server assigns when a trip switches
 * to split), else it is left out and counted in `unassignedCount`.
 * Expenses still waiting for an exchange rate (`baseAmountMinor: null`)
 * are left out and counted in `pendingFxCount`. A refund is a negative
 * amount with negative shares and reverses them.
 *
 * Settling up is greedy: the largest creditor is paid by the largest
 * debtor, the smaller of the two amounts, until everyone is at zero. Each
 * transfer zeroes at least one person, so n people need at most n − 1
 * transfers. Ties follow the order of `travellers`, so the answer is the
 * same on every device. Pure; `bigint` throughout.
 */
import { equalShares } from './equal_shares.ts'
import { toMinor, type MinorUnits } from './minor_units.ts'

export interface BalanceExpense {
  id: string
  paidByTravellerId: string | null
  /** In the expense's own currency; the shares add up to it. */
  amountMinor: MinorUnits
  /** Null while the expense waits for a rate. */
  baseAmountMinor: MinorUnits | null
}

export interface BalanceShare {
  expenseId: string
  travellerId: string
  /** In the expense's own currency. */
  shareMinor: MinorUnits
}

export interface BalancesInput {
  /** Traveller ids in display order (their `position`); ties settle in this order. */
  travellers: readonly string[]
  expenses: readonly BalanceExpense[]
  /** Live shares; an expense without any is split equally among `travellers`. */
  shares: readonly BalanceShare[]
  /** Payer of an expense that names none (the trip owner's traveller). */
  defaultPayerTravellerId?: string | null
}

export interface TravellerBalance {
  travellerId: string
  /** Base amount this traveller paid. */
  paidMinor: bigint
  /** Base amount of the shares this traveller owes. */
  owedMinor: bigint
  /** `paid − owed`: positive means the others owe this traveller. */
  netMinor: bigint
}

export interface Settlement {
  fromTravellerId: string
  toTravellerId: string
  amountMinor: bigint
}

export interface Balances {
  /** One row per traveller given, in that order, then anyone else who holds a share. */
  balances: TravellerBalance[]
  /** The transfers that bring every net to zero. */
  settlements: Settlement[]
  /** Expenses left out while they wait for an exchange rate. */
  pendingFxCount: number
  /** Expenses left out because nobody paid them and there is no default payer. */
  unassignedCount: number
}

export function balances(input: BalancesInput): Balances {
  const rows = new Map<string, TravellerBalance>()
  const row = (travellerId: string): TravellerBalance => {
    let found = rows.get(travellerId)
    if (!found) {
      found = { travellerId, paidMinor: 0n, owedMinor: 0n, netMinor: 0n }
      rows.set(travellerId, found)
    }
    return found
  }
  for (const travellerId of input.travellers) {
    row(travellerId)
  }

  const sharesByExpense = new Map<string, BalanceShare[]>()
  for (const share of input.shares) {
    const list = sharesByExpense.get(share.expenseId) ?? []
    list.push(share)
    sharesByExpense.set(share.expenseId, list)
  }

  let pendingFxCount = 0
  let unassignedCount = 0
  for (const expense of input.expenses) {
    if (expense.baseAmountMinor === null) {
      pendingFxCount++
      continue
    }
    const payer = expense.paidByTravellerId ?? input.defaultPayerTravellerId ?? null
    if (payer === null) {
      unassignedCount++
      continue
    }
    const amount = toMinor(expense.amountMinor)
    const base = toMinor(expense.baseAmountMinor)
    const shares =
      sharesByExpense.get(expense.id) ??
      equalShares(amount, input.travellers, payer).map((share) => ({
        expenseId: expense.id,
        ...share,
      }))
    let assigned = 0n
    for (const share of shares) {
      const owed = amount === 0n ? 0n : (base * toMinor(share.shareMinor)) / amount
      row(share.travellerId).owedMinor += owed
      assigned += owed
    }
    row(payer).paidMinor += base
    row(payer).owedMinor += base - assigned
  }

  const list = [...rows.values()]
  for (const entry of list) {
    entry.netMinor = entry.paidMinor - entry.owedMinor
  }
  return {
    balances: list,
    settlements: settleUp(list),
    pendingFxCount,
    unassignedCount,
  }
}

/** Greedy largest creditor / largest debtor; ties in the order of `rows`. */
function settleUp(rows: readonly TravellerBalance[]): Settlement[] {
  const open = rows.map((entry, order) => ({ id: entry.travellerId, order, net: entry.netMinor }))
  const byLargest = (sign: 1n | -1n) => (a: (typeof open)[number], b: (typeof open)[number]) => {
    const left = a.net * sign
    const right = b.net * sign
    return left === right ? a.order - b.order : left > right ? -1 : 1
  }
  const settlements: Settlement[] = []
  for (;;) {
    const creditor = open.filter((entry) => entry.net > 0n).sort(byLargest(1n))[0]
    const debtor = open.filter((entry) => entry.net < 0n).sort(byLargest(-1n))[0]
    if (!creditor || !debtor) {
      return settlements
    }
    const amount = creditor.net < -debtor.net ? creditor.net : -debtor.net
    settlements.push({
      fromTravellerId: debtor.id,
      toTravellerId: creditor.id,
      amountMinor: amount,
    })
    creditor.net -= amount
    debtor.net += amount
  }
}
