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
 *   request    — { body?: ZodSchema, query?: ZodSchema, params?: ZodSchema } (optional but recommended)
 *   response   — ZodSchema for the full response envelope (optional but recommended)
 *   rateLimit  — { maxRequests: number, windowSec: number } (optional)
 *
 * Permission binding (single `permission` key, three forms):
 *   permission: "x"             — single required permission
 *   permission: ["x", "y"]       — AND semantics (all required)
 *   permission: { anyOf: [...] } — OR semantics (at least one)
 *
 * Validation:
 *   - request: schema — auto-injects validate() before controller; skipped when omitted
 *   - response: schema — stored on req.responseSchema; respondJson() validates before sending; skipped when omitted
 *
 * Middleware execution order:
 *   1. Rate limiter (MUST run first)
 *   2. Explicit middleware (auth, etc.)
 *   3. Permission check (auto-injected from endpoint config)
 *   4. Request validation (Zod — only when request: declared)
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
 *         permission: { anyOf: ['ADMIN.FAMILIES.CREATE', 'FAMILY.CREATE'] },
 *         request:  { body: CreateFamilySchema },
 *         response: CreateFamilyResponseSchema,
 *         rateLimit: { maxRequests: 60, windowSec: 60 },
 *       },
 *     ],
 *   })
 *
 *   schema.register(app, { redisClient, connection })
 */

import { ApiContext } from './apiContext.js'
import { validateRequest as validateMiddleware } from './middleware/validate.js'
import { rateLimit as rateLimitMiddleware } from './middleware/rateLimiter.js'
import { requirePermission as requirePermissionMiddleware } from './middleware/requirePermission.js'
import { createUploadMiddleware } from './middleware/upload.js'
import { cacheMiddleware }       from './middleware/cache.js'
import { setCacheHeaders }       from './middleware/cacheHeaders.js'
import { createRedisCache }      from './redisCache.js'
import { createLogger }          from './logger.js'

const logger = createLogger('ApiSchema')

export class ApiSchema {
  /**
   * @param {{ name?: string, url?: string, endpoints: Array<{
   *   path: string,
   *   verb: string,
   *   handler: { controller: Function, method: string },
   *   middleware?: Function[],
   *   request?:  { body?: import('zod').ZodSchema, query?: import('zod').ZodSchema, params?: import('zod').ZodSchema },
   *   response?: import('zod').ZodSchema,
   *   rateLimit?: { maxRequests: number, windowSec: number },
   * }> }} config
   */
  constructor({ name, url, endpoints = [] } = {}) {
    this.name   = name ?? null
    this.url    = url?.trim() ?? ''
    this.routes = endpoints
  }

  /**
   * Register all routes on an Express app or Router.
   *
   * @param {import('express').Application | import('express').Router} app
   * @param {{ redisClient?: object, connection?: object }} [options]
   */
  register(app, options = {}) {
    const { redisClient, connection, ...extras } = options

    for (const route of this.routes) {
      const {
        path, verb, handler, middleware = [],
        request, response,
        rateLimit: rl,
        permission,
        file,
        cache: cacheConfig,
        cachePolicy,
      } = route
      const argDefs = handler.arguments
      const httpMethod = verb.toLowerCase()
      const fullPath   = this.url ? `${this.url}${path}` : path

      if (typeof app[httpMethod] !== 'function') {
        throw new Error(`[ApiSchema] unsupported verb "${verb}" on ${fullPath}`)
      }

      // Warn about missing response schema — will become a hard error in future
      // if (!response) {
      //   logger.warn(`Missing response schema: ${verb} ${fullPath}`)
      // }

      // Build a Redis cache wrapper (safe even without a Redis client)
      const cache = redisClient ? createRedisCache(redisClient) : null

      const chain = []

      // 1. Attach both schemas to req — validate() and respondJson() both read from req
      chain.push((req, _res, next) => {
        req.requestSchema  = request  ?? null
        req.responseSchema = response ?? null
        next()
      })

      // 1b. Cache-Control / Vary headers
      if (cachePolicy) {
        chain.push(setCacheHeaders(cachePolicy))
      } else {
        // Default: no-store for authenticated endpoints
        chain.push(setCacheHeaders('no-store'))
      }

      // 2. Rate limiter
      if (rl && redisClient) {
        chain.push(rateLimitMiddleware({
          prefix:      `${this.name || 'api'}:${httpMethod}:${path}`,
          maxRequests: rl.maxRequests,
          windowSec:   rl.windowSec,
          redisClient,
        }))
      }

      // 2b. Response cache (GET only)
      if (cacheConfig && cache) {
        chain.push(cacheMiddleware({
          cache,
          ttl:    cacheConfig.ttl    || 60,
          prefix: cacheConfig.prefix || `${this.name || 'api'}:${httpMethod}:${path}`,
        }))
      }

      // 3. Explicit middleware (auth, etc.)
      chain.push(...middleware)

      // 3b. File upload (multer) — auto-injected when endpoint declares file:
      if (file) {
        chain.push(createUploadMiddleware(file))
      }

      // 4. Permission
      if (permission) {
        chain.push(requirePermissionMiddleware({ permission }))
      }

      // 5. Request validation — reads req.requestSchema, skips when null
      chain.push(validateMiddleware())

      // Resolve arguments — maps string tokens to actual request-context values.
      // Every endpoint MUST declare 'arguments' explicitly (use [] for zero-argument methods).
      // Supported tokens: 'request:body', 'request:params', 'request:query', 'user'
      const resolveArgs = (defs, ctx) => {
        if (!defs) {
          throw new Error(`[ApiSchema] 'arguments' is required on every endpoint. Missing on: ${verb} ${fullPath}`)
        }
        const resolve = arg => {
          switch (arg) {
            case 'request:body':   return ctx.request.body
            case 'request:params': return ctx.request.params
            case 'request:query':  return ctx.request.query
            case 'user':           return ctx.user
            default:               return undefined
          }
        }
        return defs.map(resolve)
      }

      logger.debug(`Registered ${verb} ${fullPath}`)

      app[httpMethod](fullPath, ...chain, async (req, _res, next) => {
        try {
          const context  = new ApiContext(req, connection, extras)
          const ctrl = new handler.controller(context)
          const args = resolveArgs(argDefs, context)
          await ctrl[handler.method](...args)
        } catch (err) {
          next(err)
        }
      })
    }

    logger.info(`${this.name}: ${this.routes.length} routes mounted on ${this.url || '/'}`)
  }
}
