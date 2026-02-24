/**
 * IAM — OTP Login Repository
 */

import { BaseDbRepository } from '../../../../base/baseDbRepository.js'
import { pool } from '../../db/pool.js'
import {
  getUserByNationalIdHash,
  createUser,
  updateUserStatus,
  getUserRoles,
  getUserPermissions,
  recordLoginEvent,
  addRole,
  createOtpToken,
  getActiveOtpToken,
  incrementOtpAttempt,
  markOtpUsed,
} from '../../db/repository.js'

export class OtpLoginRepository extends BaseDbRepository {
  constructor(ctx) {
    super(ctx, pool)
  }

  findByNationalIdHash(hash)           { return getUserByNationalIdHash(hash) }
  createUser(params)                    { return createUser(params) }
  updateStatus(userId, status)          { return updateUserStatus(userId, status) }
  getRoles(userId)                      { return getUserRoles(userId) }
  getPermissions(userId)                { return getUserPermissions(userId) }
  recordEvent(params)                   { return recordLoginEvent(params) }
  addRole(userId, role)                 { return addRole(userId, role) }
  createOtpToken(params)                { return createOtpToken(params) }
  getActiveOtpToken(userId, purpose)    { return getActiveOtpToken(userId, purpose) }
  incrementOtpAttempt(tokenId)          { return incrementOtpAttempt(tokenId) }
  markOtpUsed(tokenId)                  { return markOtpUsed(tokenId) }
}
