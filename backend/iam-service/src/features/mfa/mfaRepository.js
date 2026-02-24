/**
 * IAM — MFA Repository
 */

import { BaseDbRepository } from '../../../../base/baseDbRepository.js'
import { pool } from '../../db/pool.js'
import {
  getUserById,
  updateUserMfa,
  createMfaFactor,
  getActiveMfaFactor,
  updateMfaFactorStatus,
  getMfaFactors,
  createOtpToken,
  getActiveOtpToken,
  incrementOtpAttempt,
  markOtpUsed,
} from '../../db/repository.js'

export class MfaRepository extends BaseDbRepository {
  constructor(ctx) {
    super(ctx, pool)
  }

  getUser(userId)                         { return getUserById(userId) }
  updateUserMfa(userId, enabled, secret)  { return updateUserMfa(userId, enabled, secret) }
  createFactor(params)                    { return createMfaFactor(params) }
  getActiveFactor(userId, type)           { return getActiveMfaFactor(userId, type) }
  updateFactorStatus(factorId, status)    { return updateMfaFactorStatus(factorId, status) }
  getFactors(userId)                      { return getMfaFactors(userId) }
  createOtpToken(params)                  { return createOtpToken(params) }
  getActiveOtpToken(userId, purpose)      { return getActiveOtpToken(userId, purpose) }
  incrementOtpAttempt(tokenId)            { return incrementOtpAttempt(tokenId) }
  markOtpUsed(tokenId)                    { return markOtpUsed(tokenId) }
}
