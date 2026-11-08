/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

export type { Route, Path } from './schema.d.ts'

const placeholder: any = {}

const routes = {
  'health.ready': {
    methods: ["GET","HEAD"],
    pattern: '/api/health',
    tokens: [[0,"api"],[0,"health"]],
    types: placeholder as Registry['health.ready']['types'],
  },
  'health.live': {
    methods: ["GET","HEAD"],
    pattern: '/api/health/live',
    tokens: [[0,"api"],[0,"health"],[0,"live"]],
    types: placeholder as Registry['health.live']['types'],
  },
  'config.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/config',
    tokens: [[0,"api"],[0,"v1"],[0,"config"]],
    types: placeholder as Registry['config.show']['types'],
  },
  'schemas.tripJsonV1': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/schemas/trip-json-v1',
    tokens: [[0,"api"],[0,"v1"],[0,"schemas"],[0,"trip-json-v1"]],
    types: placeholder as Registry['schemas.tripJsonV1']['types'],
  },
  'auth.signup': {
    methods: ["POST"],
    pattern: '/api/v1/auth/signup',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"signup"]],
    types: placeholder as Registry['auth.signup']['types'],
  },
  'auth.login': {
    methods: ["POST"],
    pattern: '/api/v1/auth/login',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"login"]],
    types: placeholder as Registry['auth.login']['types'],
  },
  'auth.email.verify': {
    methods: ["POST"],
    pattern: '/api/v1/auth/email/verify',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"email"],[0,"verify"]],
    types: placeholder as Registry['auth.email.verify']['types'],
  },
  'auth.password.forgot': {
    methods: ["POST"],
    pattern: '/api/v1/auth/password/forgot',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"password"],[0,"forgot"]],
    types: placeholder as Registry['auth.password.forgot']['types'],
  },
  'auth.password.reset': {
    methods: ["POST"],
    pattern: '/api/v1/auth/password/reset',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"password"],[0,"reset"]],
    types: placeholder as Registry['auth.password.reset']['types'],
  },
  'invitations.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/invitations/:token',
    tokens: [[0,"api"],[0,"v1"],[0,"invitations"],[1,"token"]],
    types: placeholder as Registry['invitations.show']['types'],
  },
  'auth.me': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/auth/me',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"me"]],
    types: placeholder as Registry['auth.me']['types'],
  },
  'auth.logout': {
    methods: ["POST"],
    pattern: '/api/v1/auth/logout',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"logout"]],
    types: placeholder as Registry['auth.logout']['types'],
  },
  'auth.logoutAll': {
    methods: ["POST"],
    pattern: '/api/v1/auth/logout-all',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"logout-all"]],
    types: placeholder as Registry['auth.logoutAll']['types'],
  },
  'auth.email.verifyCode': {
    methods: ["POST"],
    pattern: '/api/v1/auth/email/verify-code',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"email"],[0,"verify-code"]],
    types: placeholder as Registry['auth.email.verifyCode']['types'],
  },
  'auth.email.resend': {
    methods: ["POST"],
    pattern: '/api/v1/auth/email/resend',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"email"],[0,"resend"]],
    types: placeholder as Registry['auth.email.resend']['types'],
  },
  'me.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/me',
    tokens: [[0,"api"],[0,"v1"],[0,"me"]],
    types: placeholder as Registry['me.update']['types'],
  },
  'me.password': {
    methods: ["PUT"],
    pattern: '/api/v1/me/password',
    tokens: [[0,"api"],[0,"v1"],[0,"me"],[0,"password"]],
    types: placeholder as Registry['me.password']['types'],
  },
  'me.export': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/me/export',
    tokens: [[0,"api"],[0,"v1"],[0,"me"],[0,"export"]],
    types: placeholder as Registry['me.export']['types'],
  },
  'me.delete': {
    methods: ["POST"],
    pattern: '/api/v1/me/delete',
    tokens: [[0,"api"],[0,"v1"],[0,"me"],[0,"delete"]],
    types: placeholder as Registry['me.delete']['types'],
  },
  'me.restore': {
    methods: ["POST"],
    pattern: '/api/v1/me/restore',
    tokens: [[0,"api"],[0,"v1"],[0,"me"],[0,"restore"]],
    types: placeholder as Registry['me.restore']['types'],
  },
  'me.pushSubscriptions.store': {
    methods: ["POST"],
    pattern: '/api/v1/me/push-subscriptions',
    tokens: [[0,"api"],[0,"v1"],[0,"me"],[0,"push-subscriptions"]],
    types: placeholder as Registry['me.pushSubscriptions.store']['types'],
  },
  'me.pushSubscriptions.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/me/push-subscriptions/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"me"],[0,"push-subscriptions"],[1,"id"]],
    types: placeholder as Registry['me.pushSubscriptions.destroy']['types'],
  },
  'me.pushSubscriptions.test': {
    methods: ["POST"],
    pattern: '/api/v1/me/push-subscriptions/test',
    tokens: [[0,"api"],[0,"v1"],[0,"me"],[0,"push-subscriptions"],[0,"test"]],
    types: placeholder as Registry['me.pushSubscriptions.test']['types'],
  },
  'invitations.accept': {
    methods: ["POST"],
    pattern: '/api/v1/invitations/:token/accept',
    tokens: [[0,"api"],[0,"v1"],[0,"invitations"],[1,"token"],[0,"accept"]],
    types: placeholder as Registry['invitations.accept']['types'],
  },
  'trips.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/trips',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"]],
    types: placeholder as Registry['trips.index']['types'],
  },
  'trips.store': {
    methods: ["POST"],
    pattern: '/api/v1/trips',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"]],
    types: placeholder as Registry['trips.store']['types'],
  },
  'trips.import': {
    methods: ["POST"],
    pattern: '/api/v1/trips/import',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[0,"import"]],
    types: placeholder as Registry['trips.import']['types'],
  },
  'sync.pull': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/sync/pull',
    tokens: [[0,"api"],[0,"v1"],[0,"sync"],[0,"pull"]],
    types: placeholder as Registry['sync.pull']['types'],
  },
  'sync.push': {
    methods: ["POST"],
    pattern: '/api/v1/sync/push',
    tokens: [[0,"api"],[0,"v1"],[0,"sync"],[0,"push"]],
    types: placeholder as Registry['sync.push']['types'],
  },
  'fx.rates': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/fx/rates',
    tokens: [[0,"api"],[0,"v1"],[0,"fx"],[0,"rates"]],
    types: placeholder as Registry['fx.rates']['types'],
  },
  'trips.snapshot': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/trips/:tripId/snapshot',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"snapshot"]],
    types: placeholder as Registry['trips.snapshot']['types'],
  },
  'trips.nights': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/trips/:tripId/nights',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"nights"]],
    types: placeholder as Registry['trips.nights']['types'],
  },
  'trips.budget': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/trips/:tripId/budget',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"budget"]],
    types: placeholder as Registry['trips.budget']['types'],
  },
  'trips.today': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/trips/:tripId/today',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"today"]],
    types: placeholder as Registry['trips.today']['types'],
  },
  'trips.weather': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/trips/:tripId/weather',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"weather"]],
    types: placeholder as Registry['trips.weather']['types'],
  },
  'trips.export': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/trips/:tripId/export',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"export"]],
    types: placeholder as Registry['trips.export']['types'],
  },
  'trips.documents.store': {
    methods: ["POST"],
    pattern: '/api/v1/trips/:tripId/documents',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"documents"]],
    types: placeholder as Registry['trips.documents.store']['types'],
  },
  'trips.documents.file': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/trips/:tripId/documents/:id/file',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"documents"],[1,"id"],[0,"file"]],
    types: placeholder as Registry['trips.documents.file']['types'],
  },
  'trips.tasks.fromTemplate': {
    methods: ["POST"],
    pattern: '/api/v1/trips/:tripId/tasks/from-template',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"tasks"],[0,"from-template"]],
    types: placeholder as Registry['trips.tasks.fromTemplate']['types'],
  },
  'trips.emergency.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/trips/:tripId/emergency',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"emergency"]],
    types: placeholder as Registry['trips.emergency.show']['types'],
  },
  'trips.emergency.update': {
    methods: ["PUT"],
    pattern: '/api/v1/trips/:tripId/emergency',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"emergency"]],
    types: placeholder as Registry['trips.emergency.update']['types'],
  },
  'trips.phraseCards.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/trips/:tripId/phrase-cards',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"phrase-cards"]],
    types: placeholder as Registry['trips.phraseCards.index']['types'],
  },
  'trips.phraseCards.store': {
    methods: ["POST"],
    pattern: '/api/v1/trips/:tripId/phrase-cards',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"phrase-cards"]],
    types: placeholder as Registry['trips.phraseCards.store']['types'],
  },
  'trips.phraseCards.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/trips/:tripId/phrase-cards/:language',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"phrase-cards"],[1,"language"]],
    types: placeholder as Registry['trips.phraseCards.destroy']['types'],
  },
  'trips.members.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/trips/:tripId/members',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"members"]],
    types: placeholder as Registry['trips.members.index']['types'],
  },
  'trips.members.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/trips/:tripId/members/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"members"],[1,"id"]],
    types: placeholder as Registry['trips.members.destroy']['types'],
  },
  'trips.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/trips/:tripId',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"]],
    types: placeholder as Registry['trips.destroy']['types'],
  },
  'trips.transferOwnership': {
    methods: ["POST"],
    pattern: '/api/v1/trips/:tripId/transfer-ownership',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"transfer-ownership"]],
    types: placeholder as Registry['trips.transferOwnership']['types'],
  },
  'trips.members.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/trips/:tripId/members/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"members"],[1,"id"]],
    types: placeholder as Registry['trips.members.update']['types'],
  },
  'trips.invitations.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/trips/:tripId/invitations',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"invitations"]],
    types: placeholder as Registry['trips.invitations.index']['types'],
  },
  'trips.invitations.store': {
    methods: ["POST"],
    pattern: '/api/v1/trips/:tripId/invitations',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"invitations"]],
    types: placeholder as Registry['trips.invitations.store']['types'],
  },
  'trips.invitations.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/trips/:tripId/invitations/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"invitations"],[1,"id"]],
    types: placeholder as Registry['trips.invitations.destroy']['types'],
  },
  'trips.restore': {
    methods: ["POST"],
    pattern: '/api/v1/trips/:tripId/restore',
    tokens: [[0,"api"],[0,"v1"],[0,"trips"],[1,"tripId"],[0,"restore"]],
    types: placeholder as Registry['trips.restore']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
