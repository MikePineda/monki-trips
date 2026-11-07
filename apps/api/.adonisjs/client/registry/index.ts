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
