/**
 * API Context — shared across all backend services
 *
 * Wraps request, response, user, and logger into a single object
 * passed to all controllers, services, and repositories.
 *
 * Plain JavaScript — no TypeScript required.
 */

const defaultLogger = {
  info:  (msg, meta) => console.log(`[INFO]  ${msg}`, meta ?? ''),
  warn:  (msg, meta) => console.warn(`[WARN]  ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta ?? ''),
  debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta ?? ''),
}

export class ApiContext {
  /**
   * @param {import('express').Request} request
   * @param {import('express').Response} response
   * @param {object} [logger]
   */
  constructor(request, response, logger) {
    this.request  = request
    this.response = response
    this.req      = request           // alias for controllers using ctx.req
    this.res      = response          // alias for controllers using ctx.res
    this.user     = request.user      // attached by requireAuth middleware
    this.logger   = logger ?? defaultLogger
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
