/**
 * Free text cut to at most `max` characters, ending with `...` when it was
 * cut (three plain dots: the `<data>` escaping folds `…` into them anyway,
 * which would overrun the limit); null stays null. Pure: used to keep one row of a tool result
 * from carrying a whole page of notes to the model.
 */
export function clipText(text: string | null | undefined, max: number): string | null {
  if (text === null || text === undefined) return null
  const characters = [...text]
  if (characters.length <= max) return text
  return (
    characters
      .slice(0, Math.max(0, max - 3))
      .join('')
      .trimEnd() + '...'
  )
}
