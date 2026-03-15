/**
 * IAM — MFA Repository
 */

import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }    from '../../../../base/queryHelper.js'

export class MfaRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  // ── Users ─────────────────────────────────────────────────────────────

  async getUser(userId) {
    const { text, values } = new QueryHelper(this.tables.USERS).select('*')
      .where('user_id', '=', userId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async updateUserMfa(userId, enabled, secret) {
    const { text, values } = new QueryHelper(this.tables.USERS)
      .update({ mfa_enabled: enabled, mfa_secret: secret ?? null })
      .where('user_id', '=', userId)
      .toParam()
    await this.runQuery(text, values, false)
  }

  // ── MFA factors ───────────────────────────────────────────────────────

  async createFactor(fields) {
    const { text, values } = new QueryHelper(this.tables.MFA_FACTORS).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async getActiveFactor(userId, factorType) {
    const { text, values } = new QueryHelper(this.tables.MFA_FACTORS)
      .select('*')
      .where('user_id',     '=', userId)
      .where('factor_type', '=', factorType)
      .where('status',      '=', 'active')
      .limit(1)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async updateFactorStatus(factorId, status) {
    const { text, values } = new QueryHelper(this.tables.MFA_FACTORS)
      .update({ status })
      .where('id', '=', factorId)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async getFactors(userId) {
    const { text, values } = new QueryHelper(this.tables.MFA_FACTORS)
      .select('*')
      .where('user_id', '=', userId)
      .toParam()
    return await this.runQuery(text, values, true)
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

  async incrementOtpAttempt(tokenId) {
    const { text: selText, values: selValues } = new QueryHelper(this.tables.PASSWORD_RESET_TOKENS)
      .select('*')
      .where('id', '=', tokenId)
      .toParam()
    const rows = await this.runQuery(selText, selValues, true)
    const current = rows[0]?.attempt_count ?? 0
    const next = current + 1

    const { text, values } = new QueryHelper(this.tables.PASSWORD_RESET_TOKENS)
      .update({ attempt_count: next })
      .where('id', '=', tokenId)
      .toParam()
    await this.runQuery(text, values, false)
    return next
  }

  async markOtpUsed(tokenId) {
    const { text, values } = new QueryHelper(this.tables.PASSWORD_RESET_TOKENS)
      .update({ used: true })
      .where('id', '=', tokenId)
      .toParam()
    await this.runQuery(text, values, false)
  }
}
