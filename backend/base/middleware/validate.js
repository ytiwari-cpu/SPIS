/**
 * backend/base/middleware/validate.js
 *
 * Centralized Zod validation middleware.
 *
 * Supports multi-target validation in a single call:
 *   validate({ body: CreateFamilySchema })
 *   validate({ body: CreateMemberSchema, params: z.object({ id: z.string().uuid() }) })
 *   validate({ query: PaginationSchema })
 *
 * Replaces parsed+coerced data back onto req[target].
 * Collects ALL errors before throwing (no abort-early).
 *
 * Usage in route definitions:
 *   import { validate } from '../../../../base/middleware/validate.js'
 *
 *   { path: '/', verb: 'POST', handler: { ... }, middleware: [validate({ body: CreateSchema })] }
 */

import { ApplicationError } from '../applicationError.js'

const VALID_TARGETS = new Set(['body', 'query', 'params'])

/**
 * Zod validation middleware factory.
 *
 * @param {{ body?: import('zod').ZodSchema, query?: import('zod').ZodSchema, params?: import('zod').ZodSchema }} schemas
 * @returns {import('express').RequestHandler}
 */
export function validate(schemas) {
  if (!schemas || typeof schemas !== 'object') {
    throw new Error('validate() requires a schemas object, e.g. { body: ZodSchema }')
  }

  return (req, _res, next) => {
    const errors = []

    for (const [target, schema] of Object.entries(schemas)) {
      if (!schema || !VALID_TARGETS.has(target)) continue

      const result = schema.safeParse(req[target])

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
        // Replace with parsed + coerced data (strip unknown fields, apply defaults)
        req[target] = result.data
      }
    }

    if (errors.length > 0) {
      throw ApplicationError.validation('Validation failed', errors)
    }

    next()
  }
}
