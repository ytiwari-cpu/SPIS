import type { Request, Response, NextFunction } from 'express'

export interface ApiError extends Error {
  statusCode?: number
  code?: string
  details?: unknown
}

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('Error:', err)

  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal Server Error'
  const code = err.code || 'INTERNAL_ERROR'

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details: process.env.NODE_ENV === 'development' ? err.details : undefined,
    },
  })
}

// Custom error classes
export class BadRequestError extends Error implements ApiError {
  statusCode = 400
  code = 'BAD_REQUEST'
  details?: unknown

  constructor(message: string, details?: unknown) {
    super(message)
    this.name = 'BadRequestError'
    this.details = details
  }
}

export class UnauthorizedError extends Error implements ApiError {
  statusCode = 401
  code = 'UNAUTHORIZED'

  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error implements ApiError {
  statusCode = 403
  code = 'FORBIDDEN'

  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends Error implements ApiError {
  statusCode = 404
  code = 'NOT_FOUND'

  constructor(message = 'Resource not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends Error implements ApiError {
  statusCode = 409
  code = 'CONFLICT'

  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class ValidationError extends Error implements ApiError {
  statusCode = 422
  code = 'VALIDATION_ERROR'
  details: unknown

  constructor(message: string, details: unknown) {
    super(message)
    this.name = 'ValidationError'
    this.details = details
  }
}
