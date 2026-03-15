import { ApiContext } from './apiContext.js'
import { validateResponse } from './middleware/validate.js'

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

  respondOk(result = {})                {
    this.respondJson(result, 200)
  }
  respondCreated(result = {})           {
    this.respondJson(result, 201)
  }
  respondBadRequest(result = {})        {
    this.respondJson(result, 400)
  }
  respondUnauthorized(result = {})      {
    this.respondJson(result, 401)
  }
  respondForbidden(result = {})         {
    this.respondJson(result, 403)
  }
  respondNotFound(result = {})          {
    this.respondJson(result, 404)
  }
  respondConflict(result = {})          {
    this.respondJson(result, 409)
  }
  respondTooManyRequests(result = {})   {
    this.respondJson(result, 429)
  }
  respondServiceUnavailable(result = {}){
    this.respondJson(result, 503)
  }

  respondError(result = {}, statusCode = 500) {
    if (statusCode === 500) {
      this.log.error('Internal server error', {
        error:  result instanceof Error ? result.message : String(result),
        stack:  result instanceof Error ? result.stack  : undefined,
        userId: this.context.user?.sub,
        url:    `${this.context.request.method} ${this.context.request.url}`,
      })
    }
    this.respondJson(result, statusCode)
  }

  respondJson(result = {}, statusCode = 200) {
    const err = validateResponse(this.context.request, result)
    if (err) {
      this.log.error('Response validation failed', { errors: err.details })
      throw err   // caught by apiSchema.js try/catch → errorHandler
    }
    this.context.response.status(statusCode).json(result)
  }

  sendResponse(result = {}, statusCode = 200) {
    this.context.response.status(statusCode).send(result)
  }
}
