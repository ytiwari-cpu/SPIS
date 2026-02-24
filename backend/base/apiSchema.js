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
 *
 * Usage:
 *   import { ApiSchema } from '../../../../base/apiSchema.js'
 *
 *   const schema = new ApiSchema([
 *     { path: '/',    verb: 'GET',  handler: { controller: FooController, method: 'list' } },
 *     { path: '/:id', verb: 'GET',  handler: { controller: FooController, method: 'get'  }, middleware: [requireAuth()] },
 *     { path: '/',    verb: 'POST', handler: { controller: FooController, method: 'create' }, middleware: [requireAuth()] },
 *   ])
 *
 *   export function initializeRoutes(app, basePath) {
 *     schema.register(app, basePath)
 *   }
 */

import { ApiContext } from './apiContext.js'

export class ApiSchema {
  /**
   * @param {Array<{ ... }> | { name: string, url: string, endpoints: Array<{ ... }> }} schemaOrRoutes
   */

  /**
   * @param {Array<{
   *   path: string,
   *   verb: string,
   *   handler: { controller: Function, method: string },
   *   middleware?: Function[]
   * }>} schemaOrRoutes
   */
  constructor(schemaOrRoutes) {
    if (Array.isArray(schemaOrRoutes)) {
      // Legacy: plain array of route objects
      this.name   = null
      this.url    = ''
      this.routes = schemaOrRoutes
    } else if (schemaOrRoutes && schemaOrRoutes.endpoints) {
      // Preferred: { name, url, endpoints }
      this.name   = schemaOrRoutes.name   || null
      this.url    = schemaOrRoutes.url    || ''
      this.routes = schemaOrRoutes.endpoints
    } else {
      // Single route object
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
   */
  register(app, basePath) {
    const base = basePath !== undefined ? basePath : this.url
    for (const route of this.routes) {
      const { path, verb, handler, middleware = [] } = route
      const httpMethod = verb.toLowerCase()
      const fullPath   = base ? `${base}${path}` : path

      if (typeof app[httpMethod] !== 'function') {
        throw new Error(`ApiSchema: unsupported HTTP verb "${verb}"`)
      }

      app[httpMethod](
        fullPath,
        ...middleware,
        async (req, res, next) => {
          try {
            const ctx  = new ApiContext(req, res)
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
