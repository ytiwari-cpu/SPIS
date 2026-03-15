/**
 * family-service/src/lib/pool.js
 *
 * pg-compatible pool for the family-service database.
 * Schema search_path is set to 'family, public'.
 */

import { createConnection } from '../../../../base/db/createConnection.js'

export const pool = createConnection({
  connectionString: process.env.FAMILY_DATABASE_URL,
  schema: 'family',
})
