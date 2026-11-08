import { test } from '@japa/runner'
import {
  EXPENSES_CSV_COLUMNS,
  csvCell,
  decimalFromMinor,
  expensesCsv,
  type CsvExpense,
} from '#domain/expenses_csv'

function row(overrides: Partial<CsvExpense> = {}): CsvExpense {
  return {
    spentOn: '2026-03-02',
    description: 'Dinner',
    category: 'food',
    amountMinor: 4250,
    currency: 'EUR',
    baseAmountMinor: 4250,
    baseCurrency: 'EUR',
    fxRate: '1',
    paidBy: 'Traveller A',
    splitWith: ['Traveller A', 'Traveller B'],
    kind: 'expense',
    trip: 'Demo Loop',
    ...overrides,
  }
}

/** The data lines of a CSV, without the BOM and the header. */
function lines(csv: string): string[] {
  return csv
    .replace(/^\uFEFF/, '')
    .split('\r\n')
    .slice(1, -1)
}

test.group('Trip expenses CSV v1', () => {
  test('csv uses decimal amounts from minor units', ({ assert }) => {
    assert.equal(decimalFromMinor(4250, 'EUR'), '42.50')
    assert.equal(decimalFromMinor(-5, 'EUR'), '-0.05')
    assert.equal(decimalFromMinor(1200, 'JPY'), '1200')
    assert.equal(decimalFromMinor(1234, 'KWD'), '1.234')
    assert.equal(decimalFromMinor('9007199254740993', 'EUR'), '90071992547409.93')
    const [line] = lines(
      expensesCsv([
        row({ amountMinor: 1200, currency: 'JPY', baseAmountMinor: 745, fxRate: '161.07' }),
      ])
    )
    assert.equal(
      line,
      '2026-03-02,Dinner,food,1200,JPY,7.45,EUR,161.07,Traveller A,Traveller A; Traveller B,expense,Demo Loop'
    )
  })

  test('starts with a UTF-8 BOM and the v1 header, and ends every record with CRLF', ({
    assert,
  }) => {
    const csv = expensesCsv([])
    assert.isTrue(csv.startsWith('\uFEFF'))
    assert.equal(csv, `\uFEFF${EXPENSES_CSV_COLUMNS.join(',')}\r\n`)
    assert.deepEqual(EXPENSES_CSV_COLUMNS, [
      'date',
      'description',
      'category',
      'amount',
      'currency',
      'base_amount',
      'base_currency',
      'fx_rate',
      'paid_by',
      'split_with',
      'kind',
      'trip',
    ])
  })

  test('quotes commas, quotes and line breaks as RFC 4180 says', ({ assert }) => {
    assert.equal(csvCell('plain'), 'plain')
    assert.equal(csvCell('a, b'), '"a, b"')
    assert.equal(csvCell('say "hi"'), '"say ""hi"""')
    assert.equal(csvCell('two\nlines'), '"two\nlines"')
    assert.equal(csvCell(null), '')
  })

  test('csv escapes formula cells', ({ assert }) => {
    for (const start of ['=', '+', '-', '@', '\t']) {
      assert.equal(csvCell(`${start}SUM(A1)`), `'${start}SUM(A1)`, JSON.stringify(start))
    }
    // A carriage return also needs quotes: it is a line break.
    assert.equal(csvCell('\rSUM(A1)'), `"'\rSUM(A1)"`)
    assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
    assert.equal(csvCell('-cheap'), "'-cheap")
    const [line] = lines(
      expensesCsv([
        row({
          description: '=1+1',
          category: '@cmd',
          paidBy: '+Traveller',
          splitWith: ['-Traveller'],
          trip: '=Trip',
          amountMinor: -500,
          baseAmountMinor: -500,
        }),
      ])
    )
    // Numeric columns keep their minus sign: a refund stays a number.
    assert.equal(
      line,
      "2026-03-02,'=1+1,'@cmd,-5.00,EUR,-5.00,EUR,1,'+Traveller,'-Traveller,expense,'=Trip"
    )
  })

  test('settlements are marked and pending fx leaves the base columns empty', ({ assert }) => {
    const [settlement, pending] = lines(
      expensesCsv([
        row({ kind: 'settlement', description: 'Settle up', splitWith: ['Traveller B'] }),
        row({ currency: 'THB', amountMinor: 30000, baseAmountMinor: null, fxRate: null }),
      ])
    )
    assert.equal(
      settlement,
      '2026-03-02,Settle up,food,42.50,EUR,42.50,EUR,1,Traveller A,Traveller B,settlement,Demo Loop'
    )
    assert.equal(
      pending,
      '2026-03-02,Dinner,food,300.00,THB,,,,Traveller A,Traveller A; Traveller B,expense,Demo Loop'
    )
  })
})
