import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'health.ready': { paramsTuple?: []; params?: {} }
    'health.live': { paramsTuple?: []; params?: {} }
    'config.show': { paramsTuple?: []; params?: {} }
    'schemas.tripJsonV1': { paramsTuple?: []; params?: {} }
    'auth.signup': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.email.verify': { paramsTuple?: []; params?: {} }
    'auth.password.forgot': { paramsTuple?: []; params?: {} }
    'auth.password.reset': { paramsTuple?: []; params?: {} }
    'invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.logoutAll': { paramsTuple?: []; params?: {} }
    'auth.email.verifyCode': { paramsTuple?: []; params?: {} }
    'auth.email.resend': { paramsTuple?: []; params?: {} }
    'me.update': { paramsTuple?: []; params?: {} }
    'me.password': { paramsTuple?: []; params?: {} }
    'me.export': { paramsTuple?: []; params?: {} }
    'me.delete': { paramsTuple?: []; params?: {} }
    'me.restore': { paramsTuple?: []; params?: {} }
    'me.pushSubscriptions.store': { paramsTuple?: []; params?: {} }
    'me.pushSubscriptions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'me.pushSubscriptions.test': { paramsTuple?: []; params?: {} }
    'invitations.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'trips.index': { paramsTuple?: []; params?: {} }
    'trips.store': { paramsTuple?: []; params?: {} }
    'trips.import': { paramsTuple?: []; params?: {} }
    'sync.pull': { paramsTuple?: []; params?: {} }
    'sync.push': { paramsTuple?: []; params?: {} }
    'fx.rates': { paramsTuple?: []; params?: {} }
    'trips.snapshot': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.nights': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.budget': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.today': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.export': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.documents.store': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.documents.file': { paramsTuple: [ParamValue,ParamValue]; params: {'tripId': ParamValue,'id': ParamValue} }
    'trips.members.index': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'tripId': ParamValue,'id': ParamValue} }
    'trips.destroy': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.transferOwnership': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.members.update': { paramsTuple: [ParamValue,ParamValue]; params: {'tripId': ParamValue,'id': ParamValue} }
    'trips.invitations.index': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.invitations.store': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.invitations.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'tripId': ParamValue,'id': ParamValue} }
    'trips.restore': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'spa.fallback': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
  }
  GET: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'health.ready': { paramsTuple?: []; params?: {} }
    'health.live': { paramsTuple?: []; params?: {} }
    'config.show': { paramsTuple?: []; params?: {} }
    'schemas.tripJsonV1': { paramsTuple?: []; params?: {} }
    'invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'me.export': { paramsTuple?: []; params?: {} }
    'trips.index': { paramsTuple?: []; params?: {} }
    'sync.pull': { paramsTuple?: []; params?: {} }
    'fx.rates': { paramsTuple?: []; params?: {} }
    'trips.snapshot': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.nights': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.budget': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.today': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.export': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.documents.file': { paramsTuple: [ParamValue,ParamValue]; params: {'tripId': ParamValue,'id': ParamValue} }
    'trips.members.index': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.invitations.index': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'spa.fallback': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
  }
  HEAD: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'health.ready': { paramsTuple?: []; params?: {} }
    'health.live': { paramsTuple?: []; params?: {} }
    'config.show': { paramsTuple?: []; params?: {} }
    'schemas.tripJsonV1': { paramsTuple?: []; params?: {} }
    'invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'me.export': { paramsTuple?: []; params?: {} }
    'trips.index': { paramsTuple?: []; params?: {} }
    'sync.pull': { paramsTuple?: []; params?: {} }
    'fx.rates': { paramsTuple?: []; params?: {} }
    'trips.snapshot': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.nights': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.budget': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.today': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.export': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.documents.file': { paramsTuple: [ParamValue,ParamValue]; params: {'tripId': ParamValue,'id': ParamValue} }
    'trips.members.index': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.invitations.index': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'spa.fallback': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
  }
  POST: {
    'auth.signup': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.email.verify': { paramsTuple?: []; params?: {} }
    'auth.password.forgot': { paramsTuple?: []; params?: {} }
    'auth.password.reset': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.logoutAll': { paramsTuple?: []; params?: {} }
    'auth.email.verifyCode': { paramsTuple?: []; params?: {} }
    'auth.email.resend': { paramsTuple?: []; params?: {} }
    'me.delete': { paramsTuple?: []; params?: {} }
    'me.restore': { paramsTuple?: []; params?: {} }
    'me.pushSubscriptions.store': { paramsTuple?: []; params?: {} }
    'me.pushSubscriptions.test': { paramsTuple?: []; params?: {} }
    'invitations.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'trips.store': { paramsTuple?: []; params?: {} }
    'trips.import': { paramsTuple?: []; params?: {} }
    'sync.push': { paramsTuple?: []; params?: {} }
    'trips.documents.store': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.transferOwnership': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.invitations.store': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.restore': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
  }
  PATCH: {
    'me.update': { paramsTuple?: []; params?: {} }
    'trips.members.update': { paramsTuple: [ParamValue,ParamValue]; params: {'tripId': ParamValue,'id': ParamValue} }
  }
  PUT: {
    'me.password': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'me.pushSubscriptions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'trips.members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'tripId': ParamValue,'id': ParamValue} }
    'trips.destroy': { paramsTuple: [ParamValue]; params: {'tripId': ParamValue} }
    'trips.invitations.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'tripId': ParamValue,'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}