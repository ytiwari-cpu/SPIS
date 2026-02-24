/**
 * IAM — Login Repository
 *
 * All database queries related to credential-based login.
 * Wraps the monolithic db/repository.ts functions for use by LoginService.
 */

import { BaseDbRepository } from '../../../../base/baseDbRepository.js'
import { pool } from '../../db/pool.js'
import {
  getUserByNationalIdHash,
  getUserRoles,
  getUserPermissions,
  recordLoginEvent,
  incrementFailedLogins,
  resetFailedLogins,
  lockUser,
} from '../../db/repository.js'

export class LoginRepository extends BaseDbRepository {
  constructor(ctx) {
    super(ctx, pool)
  }

  findByNationalIdHash(hash) {
    return getUserByNationalIdHash(hash)
  }

  getRoles(userId) {
    return getUserRoles(userId)
  }

  getPermissions(userId) {
    return getUserPermissions(userId)
  }

  recordEvent(params) {
    return recordLoginEvent(params)
  }

  incrementFailed(userId) {
    return incrementFailedLogins(userId)
  }

  resetFailed(userId) {
    return resetFailedLogins(userId)
  }

  lock(userId, lockedUntil) {
    return lockUser(userId, lockedUntil)
  }
}
