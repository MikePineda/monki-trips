/*
|--------------------------------------------------------------------------
| HTTP kernel file
|--------------------------------------------------------------------------
|
| Server middleware runs on every request (even without a matching route);
| router middleware runs on matched routes only. Named middleware are
| attached per route in start/routes.ts.
|
*/

import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

server.errorHandler(() => import('#exceptions/handler'))

server.use([
  () => import('#middleware/container_bindings_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
  // Serves build/public (the Angular build) with the PWA cache policy.
  () => import('@adonisjs/static/static_middleware'),
])

router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/session/session_middleware'),
  // CSRF on every POST/PUT/PATCH/DELETE: the SPA echoes the XSRF-TOKEN cookie.
  () => import('@adonisjs/shield/shield_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware'),
  () => import('#middleware/detect_user_locale_middleware'),
])

export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
  verifiedEmail: () => import('#middleware/verified_email_middleware'),
  tripMember: () => import('#middleware/trip_member_middleware'),
  tripOwner: () => import('#middleware/trip_owner_middleware'),
})
