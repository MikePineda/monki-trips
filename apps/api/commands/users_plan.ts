import { args, BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { USER_PLANS, type UserPlan } from '@monkitrips/shared'
import { UserAdministration } from '#services/user_administration'

/** `node ace users:plan <email> <plan>`: moves an account between plans (`free`, `pro`). */
export default class UsersPlan extends BaseCommand {
  static commandName = 'users:plan'
  static description = 'Set the plan of an account'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'E-mail address of the account' })
  declare email: string

  @args.string({ description: `Plan: ${USER_PLANS.join(' | ')}` })
  declare plan: string

  async run() {
    if (!(USER_PLANS as readonly string[]).includes(this.plan)) {
      this.logger.error(`unknown plan; use one of ${USER_PLANS.join(', ')}`)
      this.exitCode = 1
      return
    }
    const admin = new UserAdministration()
    const user = await admin.findByEmail(this.email)
    if (!user) {
      this.logger.error('no account has that e-mail address')
      this.exitCode = 1
      return
    }
    await admin.setPlan(user, this.plan as UserPlan)
    this.logger.success(`plan set to ${this.plan}`)
  }
}
