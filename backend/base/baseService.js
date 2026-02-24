import { ApiContext } from './apiContext.js'

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

  /** Generate a UUID (uses built-in crypto — no npm package needed) */
  static genUUID() {
    return crypto.randomUUID()
  }

  /** Return the current user's subject id, or throw if unauthenticated */
  getUserId() {
    const sub = this.context.user?.sub
    if (!sub) throw new Error('User not authenticated')
    return sub
  }

  hasRole(role) {
    return (this.context.user?.roles ?? []).includes(role)
  }

  hasPermission(permission) {
    return (this.context.user?.permissions ?? []).includes(permission)
  }
}
