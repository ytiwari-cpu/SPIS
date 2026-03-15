/**
 * backend/base/middleware/validate.js
 *
 * Single place for all Zod validation logic.
 *
 * validateRequest() — middleware, reads req.requestSchema (set by apiSchema.js).
 *   Validates params/body/query. Replaces with coerced data. Collects all errors.
 *
 * validateResponse() — called from respondJson in BaseController.
 *   Reads req.responseSchema (set by apiSchema.js). Returns null on success,
 *   or an ApplicationError on failure — respondJson throws it.
 */

import { ApplicationError } from '../applicationError.js'

const VALID_TARGETS = new Set(['body', 'query', 'params'])

/**
 * Request validation middleware — reads req.requestSchema, skips when null.
 *
 * @returns {import('express').RequestHandler}
 */
export function validateRequest() {
  return (req, _res, next) => {
    const schema = req.requestSchema
    if (!schema) {
      return next()
    }

    const errors = []

    for (const [target, zodSchema] of Object.entries(schema)) {
      if (!zodSchema || !VALID_TARGETS.has(target)) {
        continue
      }

      const result = zodSchema.safeParse(req[target])

      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            field:   issue.path.join('.'),
            message: issue.message,
            code:    issue.code,
            target,
          })
        }
      } else {
        req[target] = result.data   // replace with parsed + coerced data
      }
    }

    if (errors.length > 0) {
      return next(ApplicationError.validation('Request validation failed', errors))
    }

    next()
  }
}

/**
 * Response validation — called by respondJson in BaseController.
 * Reads req.responseSchema (set by apiSchema.js), skips when null.
 *
 * @param {import('express').Request} req
 * @param {unknown} result — the object about to be sent
 * @returns {ApplicationError | null} — null means valid
 */
export function validateResponse(req, result) {
  const schema = req.responseSchema
  if (!schema) {
    return null
  }

  const check = schema.safeParse(result)
  if (check.success) {
    return null
  }

  const errors = check.error.issues.map(issue => ({
    field:   issue.path.join('.'),
    message: issue.message,
    code:    issue.code,
  }))

  return ApplicationError.responseValidation('Response validation failed', errors)
}

// Back-compat alias — validate() still works for any existing code
export { validateRequest as validate }
