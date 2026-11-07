import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { requestI18n } from '#middleware/detect_user_locale_middleware'
import { ApiException } from '#exceptions/api_exception'

/**
 * JSON-only error rendering. Every 4xx answers `{ message, code }` with the
 * message translated from `errors.<code>` in the request's locale, except
 * validation errors, which keep VineJS' `{ errors: [{ field, rule, message }] }`.
 * Business errors (`ApiException`) may add fields (`tripIds`); throttling adds
 * the rate-limit headers. A 5xx shows the debug page in development and a
 * generic translated body in production, so driver messages and table names
 * never leave the server.
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
      getDefaultHeaders?: () => Record<string, unknown>
    }

    if (httpError.code === 'E_VALIDATION_ERROR') {
      // Always JSON: the default renderer would flash and redirect a form post.
      const { messages } = error as { messages: { field: string; rule: string; message: string }[] }
      return ctx.response.status(422).send({ errors: messages })
    }

    if (httpError.status >= 400 && httpError.status < 500) {
      const code = httpError.code ?? 'E_BAD_REQUEST'
      if (typeof httpError.getDefaultHeaders === 'function') {
        for (const [name, value] of Object.entries(httpError.getDefaultHeaders())) {
          ctx.response.header(name, String(value))
        }
      }
      const payload = error instanceof ApiException ? error.payload : {}
      return ctx.response
        .status(httpError.status)
        .send({ message: translate(code, httpError.message), code, ...payload })
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
