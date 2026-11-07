import env from '#start/env'

/**
 * Whether people may sign up without an invitation (`REGISTRATION_OPEN`).
 * A class so tests can swap it and exercise the closed gate while
 * `.env.test` keeps registration open.
 */
export class RegistrationPolicy {
  isOpen(): boolean {
    return env.get('REGISTRATION_OPEN')
  }
}
