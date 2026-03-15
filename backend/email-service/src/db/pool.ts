/**
 * SPIS Email Service — PostgreSQL Connection Pool
 *
 * Thin wrapper around createConnection() used for:
 *   - pool.end() during graceful shutdown
 *   - testDbConnection() health checks
 */

import { createConnection } from '../../../base/db/createConnection.js'

export const pool = createConnection({
  connectionString: process.env.EMAIL_DATABASE_URL!,
})

/** Test the database connection — used for health checks */
export async function testDbConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await pool.query('SELECT 1')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}
