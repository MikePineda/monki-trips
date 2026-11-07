import { test } from '@japa/runner'
import type { PhraseCard } from '@monkitrips/shared'
import { llmCostMicros } from '#domain/llm_cost'
import { tokensLeft, usageMonthFromKey, usageMonthOf } from '#domain/usage_month'
import { canonicalLanguageTag, supportedLanguageTag } from '#domain/language_tag'
import { phraseCardProblems } from '#domain/phrase_card_rules'

const card = (category: PhraseCard['category'], prompt = 'Hello', phrase = 'Hola'): PhraseCard => ({
  category,
  prompt,
  phrase,
  romanization: null,
  note: null,
})

test.group('LLM domain', () => {
  test('cost is tokens times the price per million, in micro-dollars', ({ assert }) => {
    const prices = { m: { inputUsdPerMillion: 3, outputUsdPerMillion: 15 } }

    assert.equal(llmCostMicros(prices, 'm', { inputTokens: 1000, outputTokens: 200 }), 6000)
    assert.isNull(llmCostMicros(prices, 'unknown', { inputTokens: 1, outputTokens: 1 }))
  })

  test('the usage month is the utc calendar month and resets on the first', ({ assert }) => {
    const late = usageMonthOf(new Date('2026-12-31T23:59:59Z'))

    assert.equal(late.key, '2026-12')
    assert.equal(late.startsAt.toISOString(), '2026-12-01T00:00:00.000Z')
    assert.equal(late.resetsOn, '2027-01-01')
    assert.equal(usageMonthFromKey('2027-02')!.resetsOn, '2027-03-01')
    assert.isNull(usageMonthFromKey('2027-13'))
    assert.isNull(usageMonthFromKey('last month'))
  })

  test('tokens left never go below zero', ({ assert }) => {
    assert.equal(tokensLeft(1000, 400), 600)
    assert.equal(tokensLeft(1000, 1500), 0)
  })

  test('language tags are canonical bcp 47 or refused', ({ assert }) => {
    assert.equal(canonicalLanguageTag('PT-br'), 'pt-BR')
    assert.equal(canonicalLanguageTag(' ja '), 'ja')
    assert.equal(canonicalLanguageTag('zh-hant'), 'zh-Hant')
    assert.isNull(canonicalLanguageTag('japanese please'))
    assert.isNull(canonicalLanguageTag('x'))
  })

  test('a language tag is a language, an optional script and an optional region', ({ assert }) => {
    assert.equal(canonicalLanguageTag('zh-hant-tw'), 'zh-Hant-TW')
    assert.equal(canonicalLanguageTag('es-419'), 'es-419')
    for (const tag of [
      'ja-hepburn',
      'de-DE-1996',
      'ja-Latn-JP-hepburn',
      'ja-u-ca-japanese',
      'en-a-bbb',
      'ja-x-private',
      'x-private',
      'ja-JP-JP',
      'ja-Latn-Latn',
    ]) {
      assert.isNull(canonicalLanguageTag(tag), tag)
    }
  })

  test('only listed languages are supported, compared canonically', ({ assert }) => {
    const supported = ['ja', 'zh-Hant', 'pt-BR']

    assert.equal(supportedLanguageTag('JA', supported), 'ja')
    assert.equal(supportedLanguageTag('zh-hant', supported), 'zh-Hant')
    assert.equal(supportedLanguageTag('pt-br', supported), 'pt-BR')
    assert.isNull(supportedLanguageTag('ja-JP', supported))
    assert.isNull(supportedLanguageTag('zh', supported))
    assert.isNull(supportedLanguageTag('tlh', supported))
    assert.isNull(supportedLanguageTag('ja-hepburn', supported))
  })

  test('a reservation card without the name placeholder is a problem', ({ assert }) => {
    const ok = [card('greetings'), card('reservation', 'Booked under {name}', '{name} で予約')]
    const missingPlaceholder = [card('greetings'), card('reservation', 'Booked', '予約')]

    assert.deepEqual(phraseCardProblems(ok, ['greetings', 'reservation']), [])
    assert.lengthOf(phraseCardProblems(missingPlaceholder, ['greetings']), 1)
    assert.deepEqual(phraseCardProblems(ok, ['greetings', 'numbers']), [
      'no card of category "numbers"',
    ])
  })
})
