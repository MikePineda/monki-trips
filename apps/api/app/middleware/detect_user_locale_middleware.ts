import { I18n } from '@adonisjs/i18n'
import i18nManager from '@adonisjs/i18n/services/main'
import type { NextFn } from '@adonisjs/core/types/http'
import { type HttpContext, RequestValidator } from '@adonisjs/core/http'

/**
 * Shares a request-scoped `ctx.i18n`: the best supported match of
 * Accept-Language, else the default locale (English). A stored user
 * preference joins the chain once users exist (WP 0.5).
 */
export default class DetectUserLocaleMiddleware {
  /**
   * VineJS messages of `request.validateUsing` come from
   * resources/lang/<locale>/validator.json once validators exist.
   */
  static {
    RequestValidator.messagesProvider = (ctx) => ctx.i18n.createMessagesProvider()
  }

  async handle(ctx: HttpContext, next: NextFn) {
    ctx.i18n = requestI18n(ctx)
    ctx.containerResolver.bindValue(I18n, ctx.i18n)
    ctx.response.header('Content-Language', ctx.i18n.locale)
    return next()
  }
}

/** The translator for a request's Accept-Language, falling back to the default locale. */
export function requestI18n(ctx: HttpContext): I18n {
  const locale =
    i18nManager.getSupportedLocaleFor(ctx.request.languages()) ?? i18nManager.defaultLocale
  return i18nManager.locale(locale)
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    i18n: I18n
  }
}
