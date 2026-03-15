/**
 * IAM — Login Repository
 */

import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }    from '../../../../base/queryHelper.js'

export class LoginRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  // ── Users ─────────────────────────────────────────────────────────────

  async findByNationalIdHash(hash) {
    const { text, values } = new QueryHelper(this.tables.USERS)
      .select('*')
      .where('national_id_hash', '=', hash)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  // ── Roles / Permissions ───────────────────────────────────────────────

  async getRoles(userId) {
    const { text, values } = new QueryHelper(this.tables.USER_ROLES)
      .select('*')
      .where('user_id', '=', userId)
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async getPermissions(userId) {
    const { text, values } = new QueryHelper(this.tables.PERMISSIONS)
      .select('p')
      .field('DISTINCT p.permission_key')
      .join(this.tables.ROLE_PERMISSIONS, 'rp', 'rp.permission_key = p.permission_key')
      .join(this.tables.USER_ROLES, 'ur', 'rp.role_name = ur.role_name::text')
      .where('ur.user_id', '=', userId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows.map(r => r.permission_key)
  }

  // ── Login events ──────────────────────────────────────────────────────

  async recordEvent({ userId, ip, userAgent, outcome }) {
    const { text, values } = new QueryHelper(this.tables.LOGIN_EVENTS)
      .insert({ user_id: userId, ip, user_agent: userAgent, outcome })
      .toParam()
    await this.runQuery(text, values, false)
  }

  // ── Account lockout ───────────────────────────────────────────────────

  async incrementFailed(userId) {
    const { text: selText, values: selValues } = new QueryHelper(this.tables.USERS)
      .select('*')
      .where('user_id', '=', userId)
      .toParam()
    const rows = await this.runQuery(selText, selValues, true)
    const current = rows[0]?.failed_login_attempts ?? 0
    const next = current + 1

    const { text, values } = new QueryHelper(this.tables.USERS)
      .update({ failed_login_attempts: next })
      .where('user_id', '=', userId)
      .toParam()
    await this.runQuery(text, values, false)
    return next
  }

  async resetFailed(userId) {
    const { text, values } = new QueryHelper(this.tables.USERS)
      .update({ status: 'active', failed_login_attempts: 0, locked_until: null })
      .where('user_id', '=', userId)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async unlock(userId) {
    const { text, values } = new QueryHelper(this.tables.USERS)
      .update({ status: 'active', failed_login_attempts: 0, locked_until: null })
      .where('user_id', '=', userId)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async lock(userId, lockedUntil) {
    const { text, values } = new QueryHelper(this.tables.USERS)
      .update({ status: 'locked', locked_until: lockedUntil })
      .where('user_id', '=', userId)
      .toParam()
    await this.runQuery(text, values, false)
  }
}
