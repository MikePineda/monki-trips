/**
 * The spacing scale of the design system (`--space-*` in src/styles.css):
 * an 8 px grid with a 4 px half step. Layout primitives take a step name,
 * never a pixel value, so a re-skin that changes the scale moves every gap.
 */
export const SPACE_STEPS = ['0', 'half', '1', '2', '3', '4', '5', '6', '7', '8'] as const

export type Space = (typeof SPACE_STEPS)[number]
