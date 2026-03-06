/**
 * backend/base/apiSchema.js
 *
 * ApiSchema — declarative route registry.
 *
 * Each route definition describes:
 *   path       — Express path string (e.g. '/', '/:id')
 *   verb       — HTTP verb (GET, POST, PATCH, PUT, DELETE)
 *   handler    — { controller: Class, method: string }
 *   middleware — array of Express middleware functions (optional)
 *   validation — { body?: ZodSchema, query?: ZodSchema, params?: ZodSchema } (optional)
 *   rateLimit  — { maxRequests: number, windowSec: number } (optional)
 *
 * Permission binding (NEW):
 *   permission       — single required permission string
 *   permissionsAnyOf — array; user needs at least ONE
 *   permissionsAllOf — array; user needs ALL
 *
 * When `validation` is present, the validate() middleware is auto-injected.
 * When `rateLimit` is present, the rateLimit() middleware is auto-injected.
 * When any permission field is present, requirePermission middleware is auto-injected.
 *
 * Middleware execution order:
 *   1. Rate limiter (MUST run first)
 *   2. Explicit middleware (auth, etc.)
 *   3. Permission check (auto-injected from endpoint config)
 *   4. Validation (Zod)
 *   5. Controller handler
 *
 * Usage:
 *   import { ApiSchema } from '../../../../base/apiSchema.js'
 *
 *   const schema = new ApiSchema({
 *     name: 'Family',
 *     url: '/api/v1/families',
 *     endpoints: [
 *       { path: '/',    verb: 'GET',  handler: { controller: FamilyCtrl, method: 'list' },
 *         middleware: [requireAuth()],
 *         permission: 'FAMILY.VIEW',
 *       },
 *       { path: '/',    verb: 'POST', handler: { controller: FamilyCtrl, method: 'create' },
 *         middleware: [requireAuth()],
 *         permissionsAnyOf: ['ADMIN.FAMILIES.CREATE', 'FAMILY.CREATE'],
 *         validation: { body: CreateFamilySchema },
 *         rateLimit:  { maxRequests: 60, windowSec: 60 },
 *       },
 *     ],
 *   })
 *
 *   schema.register(app, undefined, { logger, redisClient })
 */

import { ApiContext } from './apiContext.js'
import { validate as validateMiddleware } from './middleware/validate.js'
import { rateLimit as rateLimitMiddleware } from './middleware/rateLimiter.js'
import { requirePermission as requirePermissionMiddleware } from './middleware/requirePermission.js'

export class ApiSchema {
  /**
   * @param {Array<{
   *   path: string,
   *   verb: string,
   *   handler: { controller: Function, method: string },
   *   middleware?: Function[],
   *   validation?: { body?: import('zod').ZodSchema, query?: import('zod').ZodSchema, params?: import('zod').ZodSchema },
   *   rateLimit?: { maxRequests: number, windowSec: number },
   * }> | { name: string, url: string, endpoints: Array<{...}> }} schemaOrRoutes
   */
  constructor(schemaOrRoutes) {
    if (Array.isArray(schemaOrRoutes)) {
      this.name   = null
      this.url    = ''
      this.routes = schemaOrRoutes
    } else if (schemaOrRoutes && schemaOrRoutes.endpoints) {
      this.name   = schemaOrRoutes.name   || null
      this.url    = schemaOrRoutes.url    || ''
      this.routes = schemaOrRoutes.endpoints
    } else {
      this.name   = null
      this.url    = ''
      this.routes = [schemaOrRoutes]
    }
  }

  /**
   * Register all routes on an Express app or Router.
   *
   * @param {import('express').Application | import('express').Router} app
   * @param {string} [basePath] — optional prefix; defaults to this.url when omitted
   * @param {{ logger?: object, redisClient?: object }} [options] — shared dependencies
   */
  register(app, basePath, options = {}) {
    const base = basePath !== undefined ? basePath : this.url
    const { logger, redisClient } = options

    for (const route of this.routes) {
      const {
        path, verb, handler, middleware = [], validation,
        rateLimit: rlConfig,
        permission, permissionsAnyOf, permissionsAllOf,
      } = route
      const httpMethod = verb.toLowerCase()
      const fullPath   = base ? `${base}${path}` : path

      if (typeof app[httpMethod] !== 'function') {
        throw new Error(`ApiSchema: unsupported HTTP verb "${verb}"`)
      }

      // Build middleware chain — ORDER MATTERS:
      // 1. Rate limiter (MUST run first — before any heavy work)
      // 2. Explicit middleware (auth, etc.)
      // 3. Permission check (auto-injected from endpoint config)
      // 4. Validation (Zod — after auth+permission, before controller)
      const chain = []

      // 1) Rate limiter FIRST — runs before auth/controller logic
      if (rlConfig && redisClient) {
        chain.push(rateLimitMiddleware({
          prefix:      `${this.name || 'api'}:${httpMethod}:${path}`,
          maxRequests: rlConfig.maxRequests,
          windowSec:   rlConfig.windowSec,
          redisClient,
          logger,
        }))
      }

      // 2) Explicit middleware (auth, permissions, etc.)
      chain.push(...middleware)

      // 3) Permission check — auto-injected when endpoint declares permission(s)
      const hasPermConfig = permission || permissionsAnyOf || permissionsAllOf
      if (hasPermConfig) {
        chain.push(requirePermissionMiddleware({ permission, permissionsAnyOf, permissionsAllOf }))
      }

      // 4) Validation LAST in middleware chain — after auth+permission, before controller
      if (validation) {
        chain.push(validateMiddleware(validation))
      }

      app[httpMethod](
        fullPath,
        ...chain,
        async (req, res, next) => {
          try {
            const ctx  = new ApiContext(req, res, logger)
            const ctrl = new handler.controller(ctx)
            await ctrl[handler.method]()
          } catch (err) {
            next(err)
          }
        },
      )
    }
  }
}
