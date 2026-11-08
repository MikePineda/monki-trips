/**
 * The accounts the suite signs in with, from e2e/e2e.env (loaded by
 * playwright.config.ts). Every value is synthetic and lives only on the
 * run's throwaway database; global-setup.ts creates the accounts.
 */
export interface E2eAccount {
  email: string
  password: string
  /** The display name the bootstrap seeder gives the account. */
  displayName: string
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set: e2e/e2e.env defines the suite's accounts`)
  }
  return value
}

/** Owns the shared trip of J11 and invites the partner. */
export function ownerAccount(): E2eAccount {
  return {
    email: required('E2E_OWNER_EMAIL'),
    password: required('E2E_OWNER_PASSWORD'),
    displayName: 'Owner',
  }
}

/** Accepts the invitation of J11. */
export function partnerAccount(): E2eAccount {
  return {
    email: required('E2E_PARTNER_EMAIL'),
    password: required('E2E_PARTNER_PASSWORD'),
    displayName: 'Partner',
  }
}

/**
 * Travels alone: J01 starts from an empty list. With a Playwright project
 * name, the account is that project's own (`solo+<project>@...`), so two
 * projects on one database never see each other's trips; global-setup.ts
 * seeds one per project.
 */
export function soloAccount(project?: string, journey?: SoloJourney): E2eAccount {
  const email = required('E2E_SOLO_EMAIL')
  const tag = [project, journey].filter(Boolean).join('-')
  return {
    email: tag ? email.replace('@', `+${tag}@`) : email,
    password: required('E2E_SOLO_PASSWORD'),
    displayName: 'Owner',
  }
}

/**
 * Journeys that wipe and recreate their solo traveller's trips. Each gets
 * its own account per project (`solo+<project>-<journey>@...`): files run
 * in parallel, and a shared account would let one journey delete another's
 * trip or show J01 a list that is not empty.
 */
export const SOLO_JOURNEYS = [
  'j02',
  'j03',
  'j04',
  'j05',
  'j05b',
  'j05c',
  'j06b',
  'j07',
  'j07w',
  'j08',
  'j10',
  'j14',
  'j15',
  'j16',
  'a11y',
] as const

export type SoloJourney = (typeof SOLO_JOURNEYS)[number]
