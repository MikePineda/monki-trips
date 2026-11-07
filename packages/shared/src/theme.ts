/**
 * Colour scheme preference stored on the account, mirrored by the CHECK
 * constraint on `users.theme`. `system` follows the device.
 */
export const THEMES = ['system', 'light', 'dark'] as const

export type Theme = (typeof THEMES)[number]
