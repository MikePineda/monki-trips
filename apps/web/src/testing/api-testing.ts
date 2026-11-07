import type { Provider } from '@angular/core'
import { ACCOUNT_API } from '../app/core/api/account-api'
import { AUTH_API } from '../app/core/api/auth-api'
import { TRIPS_API } from '../app/core/api/trips-api'
import { SESSION_API } from '../app/core/session/session-api'
import { FakeAccountApi } from './fake-account-api'
import { FakeAuthApi } from './fake-auth-api'
import { FakeSessionApi } from './fake-session-api'
import { FakeTripsApi } from './fake-trips-api'

export interface ApiFakes {
  session: FakeSessionApi
  auth: FakeAuthApi
  trips: FakeTripsApi
  account: FakeAccountApi
}

/** One fresh fake per API, for a spec to script and inspect. */
export function apiFakes(): ApiFakes {
  return {
    session: new FakeSessionApi(),
    auth: new FakeAuthApi(),
    trips: new FakeTripsApi(),
    account: new FakeAccountApi(),
  }
}

/**
 * Providers that replace every typed API token with the given fakes, so a
 * spec never loads the Tuyau client (which would reach the network).
 */
export function provideApiTesting(fakes: ApiFakes = apiFakes()): Provider[] {
  return [
    { provide: SESSION_API, useValue: fakes.session },
    { provide: AUTH_API, useValue: fakes.auth },
    { provide: TRIPS_API, useValue: fakes.trips },
    { provide: ACCOUNT_API, useValue: fakes.account },
  ]
}
