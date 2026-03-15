/**
 * API Context — shared across all backend services
 *
 * Wraps request, response, user, and logger into a single object
 * passed to all controllers, services, and repositories.
 *
 * Plain JavaScript — no TypeScript required.
 */

import { createLogger } from './logger.js'

export class ApiContext {
  /**
   * @param {import('express').Request} request
   * @param {object} connection — pg-compatible DB connection from createConnection()
   * @param {Record<string, unknown>} [extras] — additional per-service resources (familyConnection, etc.)
   */
  constructor(request, connection, extras = {}) {
    this.request    = request
    this.response   = request.res      // Express sets req.res internally
    this.user       = request.user     // attached by requireAuth middleware
    this.connection = connection
    this.logger     = createLogger('ApiContext', request)
    this.extras     = extras
  }

  get cookies() {
    return this.request.cookies ?? {}
  }

  get session() {
    return this.request.session
  }

  /**
   * Set a response header.
   * Special case: content-disposition with (type, filename) arguments.
   */
  setHeader(key, ...args) {
    if (key.toLowerCase() === 'content-disposition' && args.length === 2) {
      const [type = 'attachment', name = ''] = args
      const encoded = encodeURIComponent(name)
      this.response.setHeader(
        key,
        `${type}; filename="${encoded}"; filename*=UTF-8''${encoded}`,
      )
      return
    }
    this.response.setHeader(key, args[0])
  }
}
