import { defineConfig, drivers } from '@adonisjs/core/hash'

/**
 * scrypt with Node's defaults for now. WP 0.5 (auth) sets the production
 * cost parameters and cheap ones for the test suite.
 */
const hashConfig = defineConfig({
  default: 'scrypt',

  list: {
    scrypt: drivers.scrypt({}),
  },
})

export default hashConfig

declare module '@adonisjs/core/types' {
  export interface HashersList extends InferHashers<typeof hashConfig> {}
}
