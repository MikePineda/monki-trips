/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| Every route has a name (`.as()`): the names are the Tuyau contract the web
| app is typed against (docs/CONTRACTS.md). After changing a route, run
| `npm run codegen` and commit `apps/api/.adonisjs`.
|
| Middleware ladder: `auth` (signed in, session not revoked) -> `verifiedEmail`
| -> `tripMember` (404 for anyone outside the trip) -> `tripOwner` (403).
|
*/

import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'
import {
  throttleForgot,
  throttleLlm,
  throttleSignup,
  throttleVerify,
  throttleWeather,
} from '#start/limiter'

router.where('tripId', router.matchers.uuid())
router.where('id', router.matchers.uuid())

router
  .group(() => {
    // Probes live outside /v1 on purpose: infrastructure depends on them.
    router.get('health', [controllers.HealthChecks, 'ready']).as('health.ready')
    router.get('health/live', [controllers.HealthChecks, 'live']).as('health.live')

    router
      .group(() => {
        router.get('config', [controllers.Config, 'show']).as('config.show')
        router
          .get('schemas/trip-json-v1', [controllers.TripJson, 'schema'])
          .as('schemas.tripJsonV1')

        // Public auth
        router
          .post('auth/signup', [controllers.Auth, 'signup'])
          .as('auth.signup')
          .use(throttleSignup)
        router.post('auth/login', [controllers.Auth, 'login']).as('auth.login')
        router
          .post('auth/email/verify', [controllers.EmailVerification, 'verify'])
          .as('auth.email.verify')
          .use(throttleVerify)
        router
          .post('auth/password/forgot', [controllers.PasswordReset, 'forgot'])
          .as('auth.password.forgot')
          .use(throttleForgot)
        router
          .post('auth/password/reset', [controllers.PasswordReset, 'reset'])
          .as('auth.password.reset')
          .use(throttleVerify)
        router.get('invitations/:token', [controllers.Invitations, 'show']).as('invitations.show')

        // Signed in (verified or not)
        router
          .group(() => {
            router.get('auth/me', [controllers.Auth, 'me']).as('auth.me')
            router.post('auth/logout', [controllers.Auth, 'logout']).as('auth.logout')
            router.post('auth/logout-all', [controllers.Auth, 'logoutAll']).as('auth.logoutAll')
            router
              .post('auth/email/verify-code', [controllers.EmailVerification, 'verifyCode'])
              .as('auth.email.verifyCode')
              .use(throttleVerify)
            router
              .post('auth/email/resend', [controllers.EmailVerification, 'resend'])
              .as('auth.email.resend')
              .use(throttleVerify)

            router.patch('me', [controllers.Profile, 'update']).as('me.update')
            router.put('me/password', [controllers.Profile, 'changePassword']).as('me.password')
            router.get('me/export', [controllers.Profile, 'export']).as('me.export')
            router.post('me/delete', [controllers.Profile, 'destroy']).as('me.delete')
            router.post('me/restore', [controllers.Profile, 'restore']).as('me.restore')
            router
              .post('me/push-subscriptions', [controllers.PushSubscriptions, 'store'])
              .as('me.pushSubscriptions.store')
            router
              .delete('me/push-subscriptions/:id', [controllers.PushSubscriptions, 'destroy'])
              .as('me.pushSubscriptions.destroy')
            router
              .post('me/push-subscriptions/test', [controllers.PushSubscriptions, 'test'])
              .as('me.pushSubscriptions.test')

            router
              .post('invitations/:token/accept', [controllers.Invitations, 'accept'])
              .as('invitations.accept')
          })
          .use(middleware.auth())

        // Trips: signed in with a verified address; the trip is the tenant.
        router
          .group(() => {
            router.get('trips', [controllers.Trips, 'index']).as('trips.index')
            router.post('trips', [controllers.Trips, 'store']).as('trips.store')
            // A trip JSON v1 file always becomes a new trip of the caller (no :tripId).
            router.post('trips/import', [controllers.TripJson, 'import']).as('trips.import')

            // Sync spans every trip of the account; tenancy is checked per row and per mutation.
            router.get('sync/pull', [controllers.Sync, 'pull']).as('sync.pull')
            router.post('sync/push', [controllers.Sync, 'push']).as('sync.push')

            router.get('fx/rates', [controllers.Fx, 'rates']).as('fx.rates')

            router
              .group(() => {
                router
                  .get('trips/:tripId/snapshot', [controllers.Trips, 'snapshot'])
                  .as('trips.snapshot')
                router
                  .get('trips/:tripId/nights', [controllers.TripViews, 'nights'])
                  .as('trips.nights')
                router
                  .get('trips/:tripId/budget', [controllers.TripViews, 'budget'])
                  .as('trips.budget')
                router
                  .get('trips/:tripId/today', [controllers.TripViews, 'today'])
                  .as('trips.today')
                router
                  .get('trips/:tripId/weather', [controllers.Weather, 'show'])
                  .as('trips.weather')
                  .use(throttleWeather)
                router
                  .get('trips/:tripId/export', [controllers.TripJson, 'export'])
                  .as('trips.export')
                router
                  .post('trips/:tripId/documents', [controllers.Documents, 'store'])
                  .as('trips.documents.store')
                router
                  .get('trips/:tripId/documents/:id/file', [controllers.Documents, 'file'])
                  .as('trips.documents.file')
                router
                  .post('trips/:tripId/tasks/from-template', [controllers.Tasks, 'fromTemplate'])
                  .as('trips.tasks.fromTemplate')
                router
                  .get('trips/:tripId/emergency', [controllers.Emergency, 'show'])
                  .as('trips.emergency.show')
                router
                  .put('trips/:tripId/emergency', [controllers.Emergency, 'update'])
                  .as('trips.emergency.update')
                router
                  .get('trips/:tripId/phrase-cards', [controllers.PhraseCards, 'index'])
                  .as('trips.phraseCards.index')
                router
                  .post('trips/:tripId/phrase-cards', [controllers.PhraseCards, 'store'])
                  .as('trips.phraseCards.store')
                  .use(throttleLlm)
                router
                  .delete('trips/:tripId/phrase-cards/:language', [
                    controllers.PhraseCards,
                    'destroy',
                  ])
                  .as('trips.phraseCards.destroy')
                router
                  .get('trips/:tripId/members', [controllers.TripMembers, 'index'])
                  .as('trips.members.index')
                router
                  .delete('trips/:tripId/members/:id', [controllers.TripMembers, 'destroy'])
                  .as('trips.members.destroy')
              })
              .use(middleware.tripMember())

            router
              .group(() => {
                router.delete('trips/:tripId', [controllers.Trips, 'destroy']).as('trips.destroy')
                router
                  .post('trips/:tripId/transfer-ownership', [
                    controllers.Trips,
                    'transferOwnership',
                  ])
                  .as('trips.transferOwnership')
                router
                  .patch('trips/:tripId/members/:id', [controllers.TripMembers, 'update'])
                  .as('trips.members.update')
                router
                  .get('trips/:tripId/invitations', [controllers.TripInvitations, 'index'])
                  .as('trips.invitations.index')
                router
                  .post('trips/:tripId/invitations', [controllers.TripInvitations, 'store'])
                  .as('trips.invitations.store')
                router
                  .delete('trips/:tripId/invitations/:id', [controllers.TripInvitations, 'destroy'])
                  .as('trips.invitations.destroy')
              })
              .use([middleware.tripMember(), middleware.tripOwner()])

            router
              .post('trips/:tripId/restore', [controllers.Trips, 'restore'])
              .as('trips.restore')
              .use([middleware.tripMember({ allowDeleted: true }), middleware.tripOwner()])
          })
          .use([middleware.auth(), middleware.verifiedEmail()])
      })
      .prefix('/v1')
  })
  .prefix('/api')

/**
 * SPA fallback. MUST stay the last route: anything that is neither an API
 * route nor a static file gets index.html. Excluded from the Tuyau registry.
 */
router.get('*', [controllers.Spa, 'show']).as('spa.fallback')
