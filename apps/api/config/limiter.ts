import { defineConfig, stores } from '@adonisjs/limiter'

/**
 * Throttles live in Postgres (`rate_limits`, migration 0003): the container
 * is stateless and two replicas must share the counters. The throttles
 * themselves are defined in `start/limiter.ts`.
 */
const limiterConfig = defineConfig({
  default: 'database',
  stores: {
    database: stores.database({
      tableName: 'rate_limits',
    }),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
