/**
 * IAM — Invite Repository
 */

import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }    from '../../../../base/queryHelper.js'

export class InviteRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async findByRegistryId(registryId) {
    const { text, values } = new QueryHelper(this.tables.USERS).select('*')
      .where('registry_id', '=', registryId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async createUser(fields) {
    const { text, values } = new QueryHelper(this.tables.USERS).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

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
}
