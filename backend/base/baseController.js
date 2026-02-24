import { ApiContext } from './apiContext.js'

/**
 * BaseController — HTTP response helpers.
 * Extend this in every feature controller.
 */
export class BaseController {
  constructor(context) {
    if (!context || !(context instanceof ApiContext)) {
      throw new Error('BaseController requires an ApiContext instance')
    }
    this.context = context
    this.log     = context.logger
  }

  respondOk(result = {})         { this.respondJson(result, 200) }
  respondCreated(result = {})    { this.respondJson(result, 201) }
  respondBadRequest(result = {}) { this.respondJson(result, 400) }
  respondNotFound(result = {})   { this.respondJson(result, 404) }
  respondForbidden(result = {})  { this.respondJson(result, 403) }

  respondError(result = {}, statusCode = 500) {
    if (statusCode === 500) {
      this.log.error('Internal server error', {
        error: result instanceof Error ? result.message : String(result),
        stack: result instanceof Error ? result.stack  : undefined,
        userId: this.context.user?.sub,
        url:   `${this.context.request.method} ${this.context.request.url}`,
      })
    }
    this.respondJson(result, statusCode)
  }

  respondJson(result = {}, statusCode = 200) {
    this.context.response.status(statusCode).json(result)
  }

  sendResponse(result = {}, statusCode = 200) {
    this.context.response.status(statusCode).send(result)
  }
}
