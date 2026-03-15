/**
 * backend/base/middleware/cacheHeaders.js
 *
 * Sets Cache-Control / Vary headers on API responses.
 *
 * Policies:
 *   'no-store'   — default for authenticated endpoints
 *   'public'     — short TTL for public read endpoints
 *   'immutable'  — long TTL for versioned static assets
 *
 * Wire via apiSchema.js cachePolicy field on endpoint config,
 * or directly as middleware.
 *
 * Usage:
 *   import { setCacheHeaders } from '../../../../base/middleware/cacheHeaders.js'
 *   app.use(setCacheHeaders('no-store'))
 */

/**
 * @param {'no-store' | 'public' | 'immutable'} [policy='no-store']
 * @param {{ maxAge?: number }} [opts]
 * @returns {import('express').RequestHandler}
 */
export function setCacheHeaders(policy = 'no-store', opts = {}) {
  return (_req, res, next) => {
    switch (policy) {
      case 'public':
        res.set('Cache-Control', `public, max-age=${opts.maxAge || 60}, must-revalidate`)
        break

      case 'immutable':
        res.set('Cache-Control', `public, max-age=${opts.maxAge || 31536000}, immutable`)
        break

      case 'no-store':
      default:
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        res.set('Pragma', 'no-cache')
        res.set('Expires', '0')
        break
    }

    // Vary: Authorization on all responses to prevent CDN cross-user leaks
    res.set('Vary', 'Authorization')

    next()
  }
}
