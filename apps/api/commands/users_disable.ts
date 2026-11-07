import { args, BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { UserAdministration } from '#services/user_administration'

/**
 * `node ace users:disable <email>`: disables an account and signs it out
 * everywhere. `--enable` turns it back on. There is no platform role, so
 * this is how an operator acts on accounts.
 */
export default class UsersDisable extends BaseCommand {
  static commandName = 'users:disable'
  static description = 'Disable an account (or re-enable it with --enable)'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'E-mail address of the account' })
  declare email: string

  @flags.boolean({ description: 'Re-enable the account instead of disabling it' })
  declare enable: boolean

  async run() {
    const admin = new UserAdministration()
    const user = await admin.findByEmail(this.email)
    if (!user) {
      this.logger.error('no account has that e-mail address')
      this.exitCode = 1
      return
    }
    await admin.setDisabled(user, !this.enable)
    this.logger.success(`account ${this.enable ? 'enabled' : 'disabled and signed out everywhere'}`)
  }
}
