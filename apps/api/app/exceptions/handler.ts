import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { requestI18n } from '#middleware/detect_user_locale_middleware'

/**
 * JSON-only error rendering. Errors that render themselves (validation, CSRF
 * later) keep their shape; any other 4xx answers `{ message, code }` with the
 * message translated from `errors.<code>` in the request's locale. A 5xx shows
 * the debug page in development and a generic translated body in production,
 * so driver messages and table names never leave the server.
 */
export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction

  override async handle(error: unknown, ctx: HttpContext) {
    // ctx.i18n is missing when no route matched (router middleware did not run).
    const i18n = 'i18n' in ctx && ctx.i18n ? ctx.i18n : requestI18n(ctx)
    const translate = (code: string, fallback: string) => i18n.t(`errors.${code}`, {}, fallback)

    const httpError = this.toHttpError(error) as {
      status: number
      code?: string
      message: string
      handle?: unknown
    }
    const selfRendered = typeof httpError.handle === 'function'

    if (!selfRendered && httpError.status >= 400 && httpError.status < 500) {
      const code = httpError.code ?? 'E_BAD_REQUEST'
      return ctx.response
        .status(httpError.status)
        .send({ message: translate(code, httpError.message), code })
    }

    if (httpError.status >= 500 && !this.debug) {
      return ctx.response.status(httpError.status).send({
        message: translate('E_INTERNAL_SERVER_ERROR', 'Internal server error'),
        code: 'E_INTERNAL_SERVER_ERROR',
      })
    }

    return super.handle(error, ctx)
  }

  override async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
