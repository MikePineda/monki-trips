import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { ApiException } from '#exceptions/api_exception'

/** Trip routes need a verified address: 403 `E_EMAIL_NOT_VERIFIED` otherwise. Runs after `auth`. */
export default class VerifiedEmailMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!ctx.auth.use('web').getUserOrFail().emailVerifiedAt) {
      throw new ApiException('E_EMAIL_NOT_VERIFIED')
    }
    return next()
  }
}
