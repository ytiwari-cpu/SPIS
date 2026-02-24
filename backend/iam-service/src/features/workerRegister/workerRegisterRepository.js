/**
 * IAM — Worker Register Repository
 */

import { BaseDbRepository } from '../../../../base/baseDbRepository.js'
import { pool } from '../../db/pool.js'
import {
  createUser,
  getUserByNationalIdHash,
  addRole,
  createOtpToken,
  getActiveOtpToken,
  markOtpUsed,
  updateUserPassword,
  updateUserStatus,
} from '../../db/repository.js'

export class WorkerRegisterRepository extends BaseDbRepository {
  constructor(ctx) {
    super(ctx, pool)
  }

  findByNationalIdHash(hash)         { return getUserByNationalIdHash(hash) }
  createUser(params)                  { return createUser(params) }
  addRole(userId, roleName)           { return addRole(userId, roleName) }
  createOtpToken(params)              { return createOtpToken(params) }
  getActiveOtpToken(userId, purpose)  { return getActiveOtpToken(userId, purpose) }
  markOtpUsed(tokenId)               { return markOtpUsed(tokenId) }
  updatePassword(userId, hash)        { return updateUserPassword(userId, hash) }
  updateStatus(userId, status)        { return updateUserStatus(userId, status) }
}
