import db from '@adonisjs/lucid/services/db'

/**
 * How many SQL statements `work` runs on the default connection. It listens
 * to the knex `query` event of the client the test runs on (the global
 * transaction of the functional suite), so every builder, model and raw
 * query counts.
 */
export async function countQueries(work: () => Promise<unknown>): Promise<number> {
  const client = db.connection().getWriteClient()
  let count = 0
  const listener = () => {
    count += 1
  }
  client.on('query', listener)
  try {
    await work()
  } finally {
    client.off('query', listener)
  }
  return count
}
