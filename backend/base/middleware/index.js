/**
 * backend/base/middleware/index.js
 *
 * Re-exports all centralized middleware.
 *
 * Usage:
 *   import { requestId, errorHandler, notFound, validate, rateLimit, requireAuth }
 *     from '../../../../base/middleware/index.js'
 */

export { requestId }                                          from './requestId.js'
export { errorHandler, notFound }                             from './errorHandler.js'
export { validate }                                           from './validate.js'
export { rateLimit, createRateLimiters }                      from './rateLimiter.js'
export { requireAuth, requirePermissions }                    from './requireAuth.js'
export { requirePermission }                                  from './requirePermission.js'
export { throttle }                                           from './throttle.js'
