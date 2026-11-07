import app from '@adonisjs/core/services/app'
import { defineConfig, drivers } from '@adonisjs/core/hash'

/**
 * Passwords use scrypt. Production keeps Node's recommended cost; the test
 * suite hashes hundreds of passwords per run and uses the cheapest valid
 * cost (a power of two above one), which changes nothing about correctness.
 */
const hashConfig = defineConfig({
  default: 'scrypt',

  list: {
    scrypt: drivers.scrypt(
      app.inTest
        ? { cost: 2 ** 11, blockSize: 8, parallelization: 1 }
        : { cost: 2 ** 14, blockSize: 8, parallelization: 1 }
    ),
  },
})

export default hashConfig

declare module '@adonisjs/core/types' {
  export interface HashersList extends InferHashers<typeof hashConfig> {}
}
