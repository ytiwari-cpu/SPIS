/**
 * AUDIT MIDDLEWARE
 * 
 * Automatically logs all /api requests to the audit_logs table.
 * 
 * Features:
 * - Extracts actor info from JWT
 * - Captures request/response summary (sanitized)
 * - Records timing information
 * - Supports exclusion patterns
 * 
 * SECURITY:
 * - Never logs passwords, tokens, or secrets
 * - Sanitizes request bodies before storage
 */

import type { Request, Response, NextFunction } from 'express'
import { createAuditLog } from '../db/repository.js'
import { logger } from '../lib/logger.js'
import { v4 as uuidv4 } from 'uuid'

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/**
 * Whether audit logging is enabled
 */
const AUDIT_ENABLED = process.env.AUDIT_ENABLED !== 'false'

/**
 * Paths to exclude from audit logging (supports wildcards)
 */
const EXCLUDE_PATHS = (process.env.AUDIT_EXCLUDE_PATHS || '/iam/health,/api/health,/api/mock/*').split(',')

/**
 * Sensitive fields to redact from request bodies
 */
const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'passwordHash',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'mfa_secret',
  'otp',
  'pin',
  'api_key',
  'apiKey',
  'authorization',
  'cookie',
  'session',
  'credential',
  'private_key',
  'privateKey',
]

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Check if path matches exclusion pattern
 */
function isExcludedPath(path: string): boolean {
  return EXCLUDE_PATHS.some(pattern => {
    const trimmed = pattern.trim()
    if (trimmed.endsWith('*')) {
      // Wildcard match
      return path.startsWith(trimmed.slice(0, -1))
    }
    return path === trimmed
  })
}

/**
 * Sanitize object by removing sensitive fields (deep)
 */
function sanitizeObject(obj: unknown, depth = 0): unknown {
  if (depth > 5) return '[MAX_DEPTH]'
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) {
    return obj.slice(0, 10).map(item => sanitizeObject(item, depth + 1))
  }
  
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_FIELDS.some(f => lowerKey.includes(f.toLowerCase()))) {
      result[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value, depth + 1)
    } else if (typeof value === 'string' && value.length > 500) {
      result[key] = value.slice(0, 500) + '...[TRUNCATED]'
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Generate audit action from method and path
 */
function generateAction(method: string, path: string): string {
  // Extract resource from path
  const parts = path.split('/').filter(Boolean)
  
  // Find the resource name (usually after 'api', 'v1', 'iam', etc.)
  let resource = 'UNKNOWN'
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]
    // Skip UUIDs and common prefixes
    if (/^[a-f0-9-]{36}$/i.test(part)) continue
    if (/^\d+$/.test(part)) continue
    if (['api', 'v1', 'v2', 'iam', 'admin'].includes(part)) continue
    
    resource = part.toUpperCase().replace(/-/g, '_')
    break
  }
  
  // Map HTTP method to action
  const actions: Record<string, string> = {
    GET: 'READ',
    POST: 'CREATED',
    PUT: 'UPDATED',
    PATCH: 'UPDATED',
    DELETE: 'DELETED',
  }
  
  const action = actions[method.toUpperCase()] || method.toUpperCase()
  return `${resource}_${action}`
}

/**
 * Extract resource type and ID from path
 */
function extractResource(path: string): { type: string | null; id: string | null } {
  const parts = path.split('/').filter(Boolean)
  
  // Find resource type and potential ID
  let resourceType: string | null = null
  let resourceId: string | null = null
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    
    // Skip common prefixes
    if (['api', 'v1', 'v2', 'iam', 'admin'].includes(part)) continue
    
    // Check if this looks like a UUID (resource ID)
    if (/^[a-f0-9-]{36}$/i.test(part)) {
      resourceId = part
      continue
    }
    
    // Check if this is a numeric ID
    if (/^\d+$/.test(part)) {
      resourceId = part
      continue
    }
    
    // This is likely the resource type
    if (!resourceType) {
      resourceType = part.replace(/-/g, '_')
    }
  }
  
  return { type: resourceType, id: resourceId }
}

/**
 * Get client IP from request
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

/**
 * Audit middleware factory
 */
export function auditMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if audit disabled
    if (!AUDIT_ENABLED) {
      return next()
    }
    
    // Skip excluded paths
    if (isExcludedPath(req.path)) {
      return next()
    }
    
    // Skip GET requests (read-only, high volume)
    if (req.method === 'GET') {
      return next()
    }
    
    // Skip non-API routes
    if (!req.path.startsWith('/api') && !req.path.startsWith('/iam')) {
      return next()
    }
    
    // Start timing
    const startTime = Date.now()
    
    // Generate request ID
    const requestId = (req.headers['x-request-id'] as string) || uuidv4()
    
    // Note: Actor info will be extracted in the finish handler
    // because req.user is populated by requireAuth middleware later

    // Capture original res.json to get response data
    const originalJson = res.json.bind(res)
    let responseData: unknown
    
    res.json = function (data: unknown) {
      responseData = data
      return originalJson(data)
    }
    
    // Intercept response finish
    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime
        const { type: resourceType, id: resourceId } = extractResource(req.path)
        
        // Extract actor info from JWT (set by requireAuth middleware)
        // This is done here because req.user is populated after auth middleware runs
        const actorSub = req.user?.sub as string | undefined
        const actorEmail = req.user?.email as string | undefined
        const actorRoles = req.user?.roles as string[] | undefined
        
        // Sanitize request body
        const sanitizedBody = req.body ? sanitizeObject(req.body) : null
        
        // Create audit log entry
        await createAuditLog({
          actor_sub: actorSub,
          actor_email: actorEmail,
          actor_roles: actorRoles,
          action: generateAction(req.method, req.path),
          method: req.method,
          path: req.path,
          resource_type: resourceType || undefined,
          resource_id: resourceId || undefined,
          status_code: res.statusCode,
          request_id: requestId,
          ip_address: getClientIp(req),
          user_agent: req.headers['user-agent'] as string,
          request_summary: sanitizedBody as Record<string, unknown>,
          response_summary: responseData ? {
            success: (responseData as Record<string, unknown>).success,
            // Don't log full response data, just success/error status
            error: (responseData as Record<string, unknown>).error ? {
              code: ((responseData as Record<string, unknown>).error as Record<string, unknown>)?.code,
            } : undefined,
          } : undefined,
          duration_ms: duration,
        })
      } catch (error) {
        // Don't let audit failures break the request
        logger.error('Failed to write audit log', {
          path: req.path,
          error: (error as Error).message,
        })
      }
    })
    
    next()
  }
}

export default auditMiddleware
