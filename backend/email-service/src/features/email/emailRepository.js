/**
 * emailRepository.js — DB queries for the email feature
 */

import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }    from '../../../../base/queryHelper.js'

export class EmailRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  // ── Email Requests ───────────────────────────────────────────────────

  async findByRequestId(requestId) {
    const { text, values } = new QueryHelper(this.tables.EMAIL_REQUESTS)
      .select('*')
      .where('request_id', '=', requestId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async createRequest(fields) {
    const { text, values } = new QueryHelper(this.tables.EMAIL_REQUESTS).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  // ── Rate Limits ──────────────────────────────────────────────────────

  async deleteExpiredRateLimits() {
    const now = new Date().toISOString()
    const { text, values } = new QueryHelper(this.tables.RATE_LIMITS)
      .delete()
      .where('expires_at', '<', now)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async getRateLimitUsage(key, windowStart) {
    const { text, values } = new QueryHelper(this.tables.RATE_LIMITS)
      .select('rl')
      .field('COALESCE(SUM(count), 0)::TEXT', 'total')
      .where('key', '=', key)
      .where('window_start', '>=', windowStart)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return parseInt(rows[0]?.total ?? '0', 10)
  }

  async isRateLimitEntryExists(key, windowStart) {
    const { text, values } = new QueryHelper(this.tables.RATE_LIMITS)
      .count('*')
      .where('key', '=', key)
      .where('window_start', '=', windowStart)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return parseInt(rows[0]?.count ?? '0', 10) > 0
  }

  async getRateLimitEntry(key, windowStart) {
    const { text, values } = new QueryHelper(this.tables.RATE_LIMITS)
      .select('*')
      .where('key', '=', key)
      .where('window_start', '=', windowStart)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async updateRateLimitCount(key, windowStart, newCount) {
    const { text, values } = new QueryHelper(this.tables.RATE_LIMITS)
      .update({ count: newCount })
      .where('key', '=', key)
      .where('window_start', '=', windowStart)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async insertRateLimitEntry(fields) {
    const { text, values } = new QueryHelper(this.tables.RATE_LIMITS)
      .insert(fields)
      .toParam()
    await this.runQuery(text, values, false)
  }
}
