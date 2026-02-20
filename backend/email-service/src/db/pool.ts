/**
 * SPIS Email Service — PostgreSQL Connection Pool
 *
 * Uses Supabase REST API (exec_sql / exec_ddl RPC functions) because
 * the Supabase DB host is IPv6-only and this machine has no IPv6 routing.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EMAIL_SUPABASE_URL || process.env.SUPABASE_URL!
const supabaseKey = process.env.EMAIL_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey)

/**
 * Converts $1, $2 placeholders to inline SQL literals.
 */
function inlineParams(text: string, values?: unknown[]): string {
  if (!values || values.length === 0) return text
  let result = text
  for (let i = values.length; i >= 1; i--) {
    const v = values[i - 1]
    let literal: string
    if (v === null || v === undefined) {
      literal = 'NULL'
    } else if (typeof v === 'number') {
      literal = String(v)
    } else if (typeof v === 'boolean') {
      literal = v ? 'TRUE' : 'FALSE'
    } else if (typeof v === 'object') {
      literal = `'${JSON.stringify(v).replaceAll("'", "''")}'`
    } else if (typeof v === 'string') {
      literal = `'${v.replaceAll("'", "''")}'`
    } else {
      literal = `'${String(v as string | number)}'`
    }
    result = result.replaceAll(`$${i}`, literal)
  }
  return result
}

/**
 * Detect whether a SQL statement returns rows.
 */
function isSelectQuery(sql: string): boolean {
  const trimmed = sql.trim().toUpperCase()
  return trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')
}

function hasReturningClause(sql: string): boolean {
  return /\bRETURNING\b/i.test(sql)
}

interface QueryResult<T = Record<string, unknown>> {
  rows: T[]
  rowCount: number | null
}

export const pool = {
  async query<T = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>> {
    const sql = inlineParams(text, values)

    if (isSelectQuery(sql)) {
      // Pure SELECT: use exec_sql
      const { data, error } = await supabase.rpc('exec_sql', { query: sql })
      if (error) {
        const err = new Error(`DB query failed: ${error.message}`)
        ;(err as unknown as Record<string, unknown>).code = error.code
        throw err
      }
      const rows = (Array.isArray(data) ? data : []) as T[]
      return { rows, rowCount: rows.length }
    } else if (hasReturningClause(sql)) {
      // INSERT/UPDATE/DELETE with RETURNING: use exec_dml
      const { data, error } = await supabase.rpc('exec_dml', { query: sql })
      if (error) {
        const err = new Error(`DB query failed: ${error.message}`)
        ;(err as unknown as Record<string, unknown>).code = error.code
        throw err
      }
      const rows = (Array.isArray(data) ? data : []) as T[]
      return { rows, rowCount: rows.length }
    } else {
      // DDL/DML without RETURNING: use exec_ddl
      const { error } = await supabase.rpc('exec_ddl', { query: sql })
      if (error) {
        const err = new Error(`DB query failed: ${error.message}`)
        ;(err as unknown as Record<string, unknown>).code = error.code
        throw err
      }
      return { rows: [] as T[], rowCount: 0 }
    }
  },

  async end(): Promise<void> {
    // No-op for Supabase REST client
  },
}

/** Test the database connection — used for health checks */
export async function testDbConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await pool.query('SELECT 1')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}
