/** Card tags that Google Translate spells its own way. */
const TRANSLATE_CODES: Readonly<Record<string, string>> = {
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  'pt-BR': 'pt',
}

function translateCode(tag: string): string {
  return TRANSLATE_CODES[tag] ?? tag.split('-')[0]?.toLowerCase() ?? tag
}

/**
 * Google Translate with the language pair set, from the traveller's
 * language to the card language, for anything the cards do not cover.
 * Live translation is not built in: this only opens the site. Pure.
 */
export function translateUrl(from: string, to: string): string {
  const query = new URLSearchParams({
    sl: translateCode(from),
    tl: translateCode(to),
    op: 'translate',
  })
  return `https://translate.google.com/?${query.toString()}`
}
