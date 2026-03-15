/**
 * programme-service/src/lib/pool.js
 *
 * pg-compatible pool for the programme-service database.
 * Schema search_path is set to 'programme, public'.
 */

import { createConnection } from '../../../../base/db/createConnection.js'

export const pool = createConnection({
  connectionString: process.env.PROGRAMME_DATABASE_URL,
  schema: 'programme',
})
