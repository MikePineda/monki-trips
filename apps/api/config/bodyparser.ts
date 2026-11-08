import { defineConfig } from '@adonisjs/core/bodyparser'

/** The route pattern of `POST /trips/:tripId/receipts/extract` (start/routes.ts). */
export const RECEIPT_EXTRACT_ROUTE = '/api/v1/trips/:tripId/receipts/extract'

const bodyParserConfig = defineConfig({
  /**
   * Parse request bodies for these HTTP methods.
   * Keep this aligned with methods that receive payloads in your routes.
   */
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],

  /**
   * Config for the "application/x-www-form-urlencoded"
   * content-type parser.
   */
  form: {
    /**
     * Normalize empty string values to null.
     */
    convertEmptyStringsToNull: true,

    /**
     * Content types handled by the form parser.
     */
    types: ['application/x-www-form-urlencoded'],
  },

  /**
   * Config for the JSON parser.
   */
  json: {
    /**
     * Normalize empty string values to null.
     */
    convertEmptyStringsToNull: true,

    /**
     * A trip JSON v1 file (`POST /trips/import`) may weigh up to 2 MB; the
     * handler answers 413 `E_FILE_TOO_LARGE` above it. Sync pushes are far smaller.
     */
    limit: '2mb',

    /**
     * Content types handled by the JSON parser.
     */
    types: [
      'application/json',
      'application/json-patch+json',
      'application/vnd.api+json',
      'application/csp-report',
    ],
  },

  /**
   * Config for the "multipart/form-data" content-type parser.
   * File uploads are handled by the multipart parser.
   */
  multipart: {
    /**
     * Automatically process uploaded files into the system tmp directory.
     */
    autoProcess: true,

    /**
     * Normalize empty string values to null.
     */
    convertEmptyStringsToNull: true,

    /**
     * Maximum accepted payload size for multipart requests.
     */
    limit: '25mb',

    /**
     * Content types handled by the multipart parser.
     */
    types: ['multipart/form-data'],

    /**
     * A receipt photo is read in memory by its controller, after CSRF,
     * auth, the LLM throttle and the trip check have passed, so a refused
     * request never leaves the photo in the OS temp dir.
     */
    processManually: [RECEIPT_EXTRACT_ROUTE],
  },
})

export default bodyParserConfig
