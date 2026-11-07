import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { generateVAPIDKeys } from 'web-push'

/**
 * `node ace vapid:generate`: prints a fresh VAPID key pair as the three
 * variables to paste into the deployment's environment. Nothing is stored:
 * the keys live only in the panel (or `.env`), never in the repo or the
 * database. Running it again makes a new, unrelated pair.
 */
export default class VapidGenerate extends BaseCommand {
  static commandName = 'vapid:generate'
  static description = 'Print a new VAPID key pair for web push (to paste into the environment)'
  static options: CommandOptions = { startApp: false }

  async run() {
    const { publicKey, privateKey } = generateVAPIDKeys()
    this.logger.log(`VAPID_PUBLIC_KEY=${publicKey}`)
    this.logger.log(`VAPID_PRIVATE_KEY=${privateKey}`)
    this.logger.log('VAPID_SUBJECT=mailto:admin@example.com')
    this.logger.info(
      'Paste the three lines into the environment (replace the subject with a real contact), redeploy, then enable notifications in Settings on each phone.'
    )
  }
}
