/**
 * backend/base — shared base layer for all SPIS backend services
 *
 * Usage (from any service feature file):
 *
 *   import { ApiContext, BaseController, BaseService, BaseSupabaseRepository } from '../../../../base/index.js'
 *   import { ApplicationError }      from '../../../../base/index.js'
 *   import { createLogger }          from '../../../../base/index.js'
 *   import { QueryHelper }           from '../../../../base/index.js'
 */

// Core classes
export { ApiContext }                from './apiContext.js'
export { ApiSchema }                 from './apiSchema.js'
export { BaseController }            from './baseController.js'
export { BaseService }               from './baseService.js'
export { BaseSupabaseRepository }    from './baseSupabaseRepository.js'
export { BaseDbRepository }          from './baseDbRepository.js'

// New: centralized error class
export { ApplicationError }          from './applicationError.js'

// New: structured logger
export { createLogger }              from './logger.js'

// New: query helper
export { QueryHelper }               from './queryHelper.js'

// New: table name constants (single source of truth)
export { TABLES, FAMILY_TABLES, IAM_TABLES, EMAIL_TABLES, PROGRAMME_TABLES } from './table.js'

// New: middleware (re-export from middleware/index.js for convenience)
export {
  requestId,
  errorHandler,
  notFound,
  validate,
  rateLimit,
  createRateLimiters,
  requireAuth,
  requirePermissions,
  requirePermission,
  auditMiddleware,
  throttle,
} from './middleware/index.js'
