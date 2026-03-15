/**
 * IAM — Worker Register Repository
 */

import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }    from '../../../../base/queryHelper.js'

export class WorkerRegisterRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  // ── Users ─────────────────────────────────────────────────────────────

  async findByNationalIdHash(hash) {
    const { text, values } = new QueryHelper(this.tables.USERS).select('*')
      .where('national_id_hash', '=', hash)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async createUser(fields) {
    const { text, values } = new QueryHelper(this.tables.USERS).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async updatePassword(userId, fields) {
    const { text, values } = new QueryHelper(this.tables.USERS).update(fields)
      .where('user_id', '=', userId)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async updateStatus(userId, status) {
    const { text, values } = new QueryHelper(this.tables.USERS).update({ status })
      .where('user_id', '=', userId)
      .toParam()
    await this.runQuery(text, values, false)
  }

  // ── Roles ─────────────────────────────────────────────────────────────

  async isUserRoleExists(userId, roleName) {
    const { text, values } = new QueryHelper(this.tables.USER_ROLES)
      .count('*')
      .where('user_id', '=', userId)
      .where('role_name', '=', roleName)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return parseInt(rows[0]?.count ?? '0', 10) > 0
  }

  async insertUserRole(userId, roleName) {
    const { text, values } = new QueryHelper(this.tables.USER_ROLES)
      .insert({ user_id: userId, role_name: roleName })
      .toParam()
    await this.runQuery(text, values, false)
  }

  // ── OTP tokens ────────────────────────────────────────────────────────

  async createOtpToken({ id, userId, otpHash, purpose, expiresAt, maxAttempts = 5 }) {
    const { text: expireText, values: expireValues } = new QueryHelper(this.tables.PASSWORD_RESET_TOKENS)
      .update({ used: true })
      .where('user_id', '=', userId)
      .where('purpose', '=', purpose)
      .where('used',    '=', false)
      .toParam()
    await this.runQuery(expireText, expireValues, false)

    const { text, values } = new QueryHelper(this.tables.PASSWORD_RESET_TOKENS)
      .insert({ id, user_id: userId, otp_hash: otpHash, purpose, expires_at: expiresAt, max_attempts: maxAttempts })
      .toParam()
    await this.runQuery(text, values, false)
  }

  async getActiveOtpToken(userId, purpose) {
    const now = new Date().toISOString()
    const { text, values } = new QueryHelper(this.tables.PASSWORD_RESET_TOKENS)
      .select('*')
      .where('user_id', '=', userId)
      .where('purpose', '=', purpose)
      .where('used', '=', false)
      .where('expires_at', '>', now)
      .orderBy('created_at', 'DESC')
      .limit(1)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    const token = rows[0] ?? null
    if (token && token.attempt_count >= token.max_attempts) {
      return null
    }
    return token
  }

  async markOtpUsed(tokenId) {
    const { text, values } = new QueryHelper(this.tables.PASSWORD_RESET_TOKENS)
      .update({ used: true })
      .where('id', '=', tokenId)
      .toParam()
    await this.runQuery(text, values, false)
  }
}
