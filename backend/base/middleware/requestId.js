/**
 * backend/base/middleware/requestId.js
 *
 * Propagates or generates X-Request-Id for every request.
 * Must be the FIRST middleware in the stack.
 */

import crypto from 'node:crypto'

/**
 * @returns {import('express').RequestHandler}
 */
export function requestId() {
  return (req, _res, next) => {
    const id = req.headers['x-request-id'] || crypto.randomUUID()
    req.requestId = id
    _res.setHeader('X-Request-Id', id)
    next()
  }
}
