/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractRawResponse, ExtractResponse, Method, PathWithRegistry, PatternsByMethod, RouteWithRegistry } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'
import type { routes } from './index.ts'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'health.ready': {
    methods: ["GET","HEAD"]
    pattern: '/api/health'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/health_checks_controller').default['ready']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/health_checks_controller').default['ready']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/health_checks_controller').default['ready']>>>
    }
  }
  'health.live': {
    methods: ["GET","HEAD"]
    pattern: '/api/health/live'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/health_checks_controller').default['live']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/health_checks_controller').default['live']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/health_checks_controller').default['live']>>>
    }
  }
  'config.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/config'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/config_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/config_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/config_controller').default['show']>>>
    }
  }
  'auth.signup': {
    methods: ["POST"]
    pattern: '/api/v1/auth/signup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth').signupValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth').signupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['signup']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['signup']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['signup']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.login': {
    methods: ["POST"]
    pattern: '/api/v1/auth/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['login']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['login']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['login']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.email.verify': {
    methods: ["POST"]
    pattern: '/api/v1/auth/email/verify'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth').verifyEmailValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth').verifyEmailValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['verify']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['verify']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['verify']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.password.forgot': {
    methods: ["POST"]
    pattern: '/api/v1/auth/password/forgot'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth').forgotPasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth').forgotPasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['forgot']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['forgot']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['forgot']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.password.reset': {
    methods: ["POST"]
    pattern: '/api/v1/auth/password/reset'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth').resetPasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth').resetPasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['reset']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['reset']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['reset']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'invitations.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/invitations/:token'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { token: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invitations_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invitations_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/invitations_controller').default['show']>>>
    }
  }
  'auth.me': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/auth/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['me']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['me']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['me']>>>
    }
  }
  'auth.logout': {
    methods: ["POST"]
    pattern: '/api/v1/auth/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['logout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['logout']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['logout']>>>
    }
  }
  'auth.logoutAll': {
    methods: ["POST"]
    pattern: '/api/v1/auth/logout-all'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['logoutAll']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['logoutAll']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['logoutAll']>>>
    }
  }
  'auth.email.verifyCode': {
    methods: ["POST"]
    pattern: '/api/v1/auth/email/verify-code'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth').verifyCodeValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth').verifyCodeValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['verifyCode']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['verifyCode']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['verifyCode']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.email.resend': {
    methods: ["POST"]
    pattern: '/api/v1/auth/email/resend'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['resend']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['resend']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['resend']>>>
    }
  }
  'me.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/me'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/account').updateProfileValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/account').updateProfileValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'me.password': {
    methods: ["PUT"]
    pattern: '/api/v1/me/password'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/account').changePasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/account').changePasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['changePassword']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['changePassword']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['changePassword']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'me.export': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/me/export'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['export']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['export']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['export']>>>
    }
  }
  'me.delete': {
    methods: ["POST"]
    pattern: '/api/v1/me/delete'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/account').deleteAccountValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/account').deleteAccountValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'me.restore': {
    methods: ["POST"]
    pattern: '/api/v1/me/restore'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['restore']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['restore']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['restore']>>>
    }
  }
  'me.pushSubscriptions.store': {
    methods: ["POST"]
    pattern: '/api/v1/me/push-subscriptions'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/push_subscription').registerPushSubscriptionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/push_subscription').registerPushSubscriptionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/push_subscriptions_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/push_subscriptions_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/push_subscriptions_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'me.pushSubscriptions.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/me/push-subscriptions/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/push_subscriptions_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/push_subscriptions_controller').default['destroy']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/push_subscriptions_controller').default['destroy']>>>
    }
  }
  'invitations.accept': {
    methods: ["POST"]
    pattern: '/api/v1/invitations/:token/accept'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { token: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invitations_controller').default['accept']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invitations_controller').default['accept']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/invitations_controller').default['accept']>>>
    }
  }
  'trips.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/trips'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['index']>>>
    }
  }
  'trips.store': {
    methods: ["POST"]
    pattern: '/api/v1/trips'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/trip').createTripValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/trip').createTripValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'trips.snapshot': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/trips/:tripId/snapshot'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { tripId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['snapshot']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['snapshot']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['snapshot']>>>
    }
  }
  'trips.members.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/trips/:tripId/members'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { tripId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trip_members_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trip_members_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/trip_members_controller').default['index']>>>
    }
  }
  'trips.members.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/trips/:tripId/members/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { tripId: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trip_members_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trip_members_controller').default['destroy']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/trip_members_controller').default['destroy']>>>
    }
  }
  'trips.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/trips/:tripId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { tripId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['destroy']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['destroy']>>>
    }
  }
  'trips.transferOwnership': {
    methods: ["POST"]
    pattern: '/api/v1/trips/:tripId/transfer-ownership'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/trip_member').transferOwnershipValidator)>>
      paramsTuple: [ParamValue]
      params: { tripId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/trip_member').transferOwnershipValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['transferOwnership']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['transferOwnership']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['transferOwnership']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'trips.members.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/trips/:tripId/members/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/trip_member').updateMemberValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { tripId: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/trip_member').updateMemberValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trip_members_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trip_members_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/trip_members_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'trips.invitations.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/trips/:tripId/invitations'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { tripId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trip_invitations_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trip_invitations_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/trip_invitations_controller').default['index']>>>
    }
  }
  'trips.invitations.store': {
    methods: ["POST"]
    pattern: '/api/v1/trips/:tripId/invitations'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/trip_invitation').createInvitationValidator)>>
      paramsTuple: [ParamValue]
      params: { tripId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/trip_invitation').createInvitationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trip_invitations_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trip_invitations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/trip_invitations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'trips.invitations.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/trips/:tripId/invitations/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { tripId: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trip_invitations_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trip_invitations_controller').default['destroy']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/trip_invitations_controller').default['destroy']>>>
    }
  }
  'trips.restore': {
    methods: ["POST"]
    pattern: '/api/v1/trips/:tripId/restore'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { tripId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['restore']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['restore']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/trips_controller').default['restore']>>>
    }
  }
}

export namespace Route {
  export type Request<Name extends keyof typeof routes> = RouteWithRegistry.Request<typeof routes, Name>
  export type Response<Name extends keyof typeof routes> = RouteWithRegistry.Response<typeof routes, Name>
  export type Params<Name extends keyof typeof routes> = RouteWithRegistry.Params<typeof routes, Name>
  export type Body<Name extends keyof typeof routes> = RouteWithRegistry.Body<typeof routes, Name>
  export type Query<Name extends keyof typeof routes> = RouteWithRegistry.Query<typeof routes, Name>
  export type Error<Name extends keyof typeof routes> = RouteWithRegistry.Error<typeof routes, Name>
}

export namespace Path {
  export type Request<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Request<typeof routes, M, P>
  export type Response<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Response<typeof routes, M, P>
  export type Params<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Params<typeof routes, M, P>
  export type Body<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Body<typeof routes, M, P>
  export type Query<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Query<typeof routes, M, P>
  export type Error<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Error<typeof routes, M, P>
}
