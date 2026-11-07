import vine from '@vinejs/vine'

/** Query of `POST /trips/import`: `dryRun` validates and reports without writing. */
export const tripImportQueryValidator = vine.compile(
  vine.object({
    dryRun: vine.boolean().optional(),
  })
)
