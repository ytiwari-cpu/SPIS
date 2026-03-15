// base/db/createConnection.js
import pg from 'pg'

/**
 * Creates a pg-compatible connection object backed by a real pg.Pool.
 *
 * @param {object} options
 * @param {string} options.connectionString - PostgreSQL connection URL
 * @param {string} [options.schema]         - Schema name ('family' | 'programme').
 *                                            When set, every new client runs
 *                                            SET search_path = <schema>, public
 * @returns {{ query(text, values?): Promise<{ rows, rowCount }>, end(): Promise<void> }}
 */
export function createConnection({ connectionString, schema } = {}) {
  if (!connectionString) {
    throw new Error('[createConnection] connectionString is required')
  }

  const pool = new pg.Pool({
    connectionString,
    max:                     parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis:       30_000,
    connectionTimeoutMillis: 10_000,
    options:                 '--statement_timeout=10000 --lock_timeout=5000',
  })

  if (schema) {
    pool.on('connect', (client) => {
      client.query(`SET search_path = ${schema}, public`)
    })
  }

  pool.on('error', (err) => {
    console.error('[createConnection] idle client error', err.message)
  })

  return {
    async query(text, values = []) {
      const result = await pool.query(text, values)
      return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length }
    },
    async end() {
      await pool.end()
    },
  }
}

/**
 * Probe the DB connection with retries and exponential back-off.
 *
 * Retries up to `maxAttempts` times before throwing so that transient
 * network blips (common when multiple services boot simultaneously against
 * a remote Supabase instance) don't crash a service on its first attempt.
 *
 * @param {{ query: Function }} connection  - Object returned by createConnection()
 * @param {object}  [opts]
 * @param {string}  [opts.label]            - Service name for log messages
 * @param {number}  [opts.maxAttempts]      - Max retry attempts (default 10)
 * @param {number}  [opts.initialDelay]     - First retry delay in ms (default 1000)
 * @param {number}  [opts.maxDelay]         - Back-off ceiling in ms (default 15000)
 */
export async function waitForDb(connection, {
  label        = 'service',
  maxAttempts  = 10,
  initialDelay = 1_000,
  maxDelay     = 15_000,
} = {}) {
  let attempt = 0
  let delay   = initialDelay

  while (true) {
    attempt++
    try {
      await connection.query('SELECT 1')
      // eslint-disable-next-line no-console
      console.info(`[${label}] Database connection verified ✓ (attempt ${attempt})`)
      return
    } catch (err) {
      if (attempt >= maxAttempts) {
        throw new Error(
          `[${label}] DB not reachable after ${maxAttempts} attempts: ${err.message}`,
        )
      }
      console.warn(
        `[${label}] DB probe failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms… (${err.message})`,
      )
      await new Promise(resolve => setTimeout(resolve, delay))
      delay = Math.min(delay * 2, maxDelay)
    }
  }
}
