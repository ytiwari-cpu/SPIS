/**
 * backend/base/applicationError.js
 *
 * Centralized error class for all SPIS backend services.
 *
 * Replaces per-service error classes (BadRequestError, NotFoundError, etc.)
 * with a single class that carries HTTP status code, machine-readable code,
 * human-readable message, and optional details.
 *
 * Usage:
 *   import { ApplicationError } from '../../../../base/applicationError.js'
 *
 *   throw ApplicationError.badRequest('Missing family_id')
 *   throw ApplicationError.notFound('Family not found')
 *   throw ApplicationError.validation('Validation failed', [{ field: 'name', message: 'Required' }])
 */

export class ApplicationError extends Error {
  /**
   * @param {number} statusCode  — HTTP status (400, 404, 500, …)
   * @param {string} message     — Human-readable error message
   * @param {string} code        — Machine-readable code (e.g. 'BAD_REQUEST')
   * @param {unknown} [details]  — Extra info (validation errors, debug data)
   */
  constructor(statusCode, message, code, details) {
    super(message)
    this.name       = 'ApplicationError'
    this.statusCode = statusCode
    this.code       = code
    this.details    = details
    Error.captureStackTrace?.(this, this.constructor)
  }

  /**
   * Serialize for JSON response.
   * In production, stack trace and details are omitted for 5xx errors.
   */
  toJSON(includeStack = false) {
    const obj = {
      code:    this.code,
      message: this.message,
    }
    if (this.details !== undefined) {
      obj.details = this.details
    }
    if (includeStack && this.stack) {
      obj.stack = this.stack
    }
    return obj
  }

  // ═══════════════════════════════════════════════════════════════
  // FACTORY METHODS
  // ═══════════════════════════════════════════════════════════════

  /** 400 Bad Request */
  static badRequest(message = 'Bad request', details) {
    return new ApplicationError(400, message, 'BAD_REQUEST', details)
  }

  /** 401 Unauthorized */
  static unauthorized(message = 'Unauthorized') {
    return new ApplicationError(401, message, 'UNAUTHORIZED')
  }

  /** 403 Forbidden */
  static forbidden(message = 'Forbidden') {
    return new ApplicationError(403, message, 'FORBIDDEN')
  }

  /** 404 Not Found */
  static notFound(message = 'Not found') {
    return new ApplicationError(404, message, 'NOT_FOUND')
  }

  /** 409 Conflict */
  static conflict(message = 'Conflict') {
    return new ApplicationError(409, message, 'CONFLICT')
  }

  /**
   * 422 Validation Error
   * @param {string} message
   * @param {Array<{ field: string, message: string, code?: string, target?: string }>} errors
   */
  static validation(message = 'Validation failed', errors = []) {
    return new ApplicationError(422, message, 'VALIDATION_ERROR', errors)
  }

  /** 429 Too Many Requests */
  static tooManyRequests(message = 'Too many requests') {
    return new ApplicationError(429, message, 'TOO_MANY_REQUESTS')
  }

  /** 500 Internal Server Error */
  static internal(message = 'Internal server error') {
    return new ApplicationError(500, message, 'INTERNAL_ERROR')
  }

  /** 503 Service Unavailable */
  static serviceUnavailable(message = 'Service unavailable') {
    return new ApplicationError(503, message, 'SERVICE_UNAVAILABLE')
  }

  /**
   * Generic factory — create any status code.
   * @param {number} statusCode
   * @param {{ message?: string, code?: string, details?: unknown }} data
   */
  static create(statusCode, data = {}) {
    return new ApplicationError(
      statusCode,
      data.message || 'Error',
      data.code || 'ERROR',
      data.details,
    )
  }
}
