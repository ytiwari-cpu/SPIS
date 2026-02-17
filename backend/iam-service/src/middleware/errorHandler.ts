/**
 * SPIS IAM Service — Error Handler Middleware
 */

import type { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger.js'

export interface ApiError extends Error {
  statusCode?: number
  code?: string
  details?: unknown
}

export function errorHandler(err: ApiError, _req: Request, res: Response, _next: NextFunction) {
  logger.error('Unhandled error', {
    code: err.code,
    message: err.message,
    statusCode: err.statusCode,
  })

  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal Server Error'
  const code = err.code || 'INTERNAL_ERROR'

  res.status(statusCode).json({
    success: false,
    error: { code, message },
  })
}

export class BadRequestError extends Error implements ApiError {
  statusCode = 400
  code = 'BAD_REQUEST'
  constructor(message: string) { super(message); this.name = 'BadRequestError' }
}

export class UnauthorizedError extends Error implements ApiError {
  statusCode = 401
  code = 'UNAUTHORIZED'
  constructor(message = 'Authentication required') { super(message); this.name = 'UnauthorizedError' }
}

export class ForbiddenError extends Error implements ApiError {
  statusCode = 403
  code = 'FORBIDDEN'
  constructor(message = 'Insufficient permissions') { super(message); this.name = 'ForbiddenError' }
}

export class NotFoundError extends Error implements ApiError {
  statusCode = 404
  code = 'NOT_FOUND'
  constructor(message = 'Resource not found') { super(message); this.name = 'NotFoundError' }
}

export class TooManyRequestsError extends Error implements ApiError {
  statusCode = 429
  code = 'RATE_LIMITED'
  details?: unknown
  constructor(message: string, details?: unknown) {
    super(message); this.name = 'TooManyRequestsError'; this.details = details
  }
}

export class ServiceUnavailableError extends Error implements ApiError {
  statusCode = 503
  code = 'SERVICE_UNAVAILABLE'
  constructor(message = 'Service temporarily unavailable') { super(message); this.name = 'ServiceUnavailableError' }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } })
}
