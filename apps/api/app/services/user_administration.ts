import type { UserPlan } from '@monkitrips/shared'
import User from '#models/user'
import { normalizeEmail } from '#domain/normalize_email'

/**
 * What an operator does from the CLI, since there is no platform role:
 * disable or re-enable an account and change its plan. Disabling signs the
 * person out everywhere.
 */
export class UserAdministration {
  async findByEmail(email: string): Promise<User | null> {
    return User.findBy('email', normalizeEmail(email))
  }

  async setDisabled(user: User, disabled: boolean): Promise<void> {
    user.status = disabled ? 'disabled' : 'active'
    if (disabled) user.sessionVersion += 1
    await user.save()
  }

  async setPlan(user: User, plan: UserPlan): Promise<void> {
    user.plan = plan
    await user.save()
  }
}
