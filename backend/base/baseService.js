import { ApiContext } from './apiContext.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * BaseService — auth helpers shared across all service classes.
 * Extend this in every feature service.
 */
export class BaseService {
  constructor(context) {
    if (!context || !(context instanceof ApiContext)) {
      throw new Error('BaseService requires an ApiContext instance')
    }
    this.context = context
    this.log     = context.logger
  }

  /**
   * Generate a UUID v4 in UPPERCASE.
   * Always use this in service layer for primary key generation.
   * Never use crypto.randomUUID(), uuidv4() directly, or any UUID generation in repositories.
   * @returns {string} UUID v4 in UPPERCASE — e.g. '550E8400-E29B-41D4-A716-446655440000'
   */
  static generateUUID() {
    return uuidv4().toUpperCase()
  }

  /** Return the current user's subject id, or throw if unauthenticated */
  getUserId() {
    const sub = this.context.user?.sub
    if (!sub) {
      throw new Error('User not authenticated')
    }
    return sub
  }

  hasRole(role) {
    return (this.context.user?.roles ?? []).includes(role)
  }

  hasPermission(permission) {
    return (this.context.user?.permissions ?? []).includes(permission)
  }
}
