/**
 * IAM — Password Reset Repository
 */

import { BaseDbRepository } from '../../../../base/baseDbRepository.js'
import { pool } from '../../db/pool.js'
import {
  getUserByNationalIdHash,
  updateUserStatus,
  updateUserPassword,
  createOtpToken,
  getActiveOtpToken,
  incrementOtpAttempt,
  markOtpUsed,
} from '../../db/repository.js'

export class PasswordResetRepository extends BaseDbRepository {
  constructor(ctx) {
    super(ctx, pool)
  }

  findByNationalIdHash(hash)         { return getUserByNationalIdHash(hash) }
  updateStatus(userId, status)        { return updateUserStatus(userId, status) }
  updatePassword(userId, hash)        { return updateUserPassword(userId, hash) }
  createOtpToken(params)              { return createOtpToken(params) }
  getActiveOtpToken(userId, purpose)  { return getActiveOtpToken(userId, purpose) }
  incrementOtpAttempt(tokenId)        { return incrementOtpAttempt(tokenId) }
  markOtpUsed(tokenId)               { return markOtpUsed(tokenId) }
}
