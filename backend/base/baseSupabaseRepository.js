import { ApiContext } from './apiContext.js'

/**
 * BaseSupabaseRepository
 *
 * Base repository for services that use Supabase (programme-service, family-service).
 * Accepts the supabase client as a constructor argument so each service
 * can inject its own configured client without path coupling.
 */
export class BaseSupabaseRepository {
  /**
   * @param {ApiContext} context
   * @param {import('@supabase/supabase-js').SupabaseClient} db  — supabase client
   */
  constructor(context, db) {
    if (!context || !(context instanceof ApiContext)) {
      throw new Error('BaseSupabaseRepository requires an ApiContext instance')
    }
    this.context = context
    this.log     = context.logger
    this.db      = db
  }

  from(table) {
    if (!this.db) throw new Error(`Database client not configured — check environment variables (missing SUPABASE_URL / SERVICE_ROLE_KEY)`)
    return this.db.from(table)
  }

  async insertOne(table, record) {
    const { data, error } = await this.db.from(table).insert(record).select().single()
    if (error) throw new Error(`Insert into ${table} failed: ${error.message}`)
    return data
  }

  async updateOne(table, updates, column, value) {
    const { data, error } = await this.db.from(table).update(updates).eq(column, value).select().single()
    if (error) throw new Error(`Update ${table} failed: ${error.message}`)
    return data
  }

  async findOne(table, column, value, selectExpr = '*') {
    const { data, error } = await this.db.from(table).select(selectExpr).eq(column, value).single()
    if (error?.code === 'PGRST116') return null   // row not found — not an error
    if (error) throw new Error(`Query ${table} failed: ${error.message}`)
    return data
  }
}
