import { inject } from '@angular/core'
import { Router, type CanActivateFn } from '@angular/router'
import { OnlineStore } from '../offline/online.store'
import { RETURN_URL_PARAM, SessionStore } from './session.store'

/**
 * Lets signed-in people through, from the cached session when there is no
 * network. Only an online visit with no session goes to /login (with the
 * target in `returnUrl`): the app is never kicked to the sign-in page offline.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const session = inject(SessionStore)
  const online = inject(OnlineStore)
  const router = inject(Router)

  const user = await session.restore()
  if (user || !online.online()) {
    return true
  }
  return router.createUrlTree(['/login'], { queryParams: { [RETURN_URL_PARAM]: state.url } })
}
