/**
 * The catalogue key of a counted phrase: `<base>One` for exactly one,
 * `<base>Other` otherwise (the catalogues carry both). Pure.
 */
export function countKey(base: string, count: number): string {
  return `${base}${count === 1 ? 'One' : 'Other'}`
}
