/**
 * SPIS IAM Service — Database connection pool
 *
 * Thin wrapper around createConnection() used for:
 *   - pool.end() during graceful shutdown
 *   - testDbConnection() health checks
 */

import { createConnection } from '../../../base/db/createConnection.js'

export const pool = createConnection({
  connectionString: process.env.IAM_DATABASE_URL || process.env.DATABASE_URL!,
})

export async function testDbConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1 as test')
    return result.rows.length === 1
  } catch {
    return false
  }
}
