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

/** Travels alone: J01 relies on an empty list, so nothing else touches this account. */
export function soloAccount(): E2eAccount {
  return {
    email: required('E2E_SOLO_EMAIL'),
    password: required('E2E_SOLO_PASSWORD'),
    displayName: 'Owner',
  }
}
