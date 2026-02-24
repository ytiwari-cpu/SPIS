/**
 * IAM — Invite Repository
 */

import { BaseDbRepository } from '../../../../base/baseDbRepository.js'
import { pool } from '../../db/pool.js'
import { createUser, getUserByRegistryId, addRole, createOtpToken } from '../../db/repository.js'

export class InviteRepository extends BaseDbRepository {
  constructor(ctx) {
    super(ctx, pool)
  }

  findByRegistryId(registryId)  { return getUserByRegistryId(registryId) }
  createUser(params)             { return createUser(params) }
  addRole(userId, roleName)      { return addRole(userId, roleName) }
  createOtpToken(params)         { return createOtpToken(params) }
}
