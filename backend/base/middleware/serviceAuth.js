// base/middleware/serviceAuth.js
import crypto from 'crypto'

/**
 * Middleware that validates a shared API key in the X-Service-Key header.
 * Used for inter-service endpoints (email, webhooks) that don't use user JWTs.
 *
 * Uses crypto.timingSafeEqual() to prevent timing attacks that could reveal
 * the key length or value through response-time measurement.
 */
export function requireServiceAuth() {
  let keyBuf = null // lazy — computed on first request

  return (req, res, next) => {
    if (!keyBuf) {
      const key = process.env.SERVICE_AUTH_KEY
      if (!key) {
        console.error('[serviceAuth] SERVICE_AUTH_KEY env var not set — rejecting request')
        return res.status(500).json({
          success: false,
          error:   { code: 'SERVER_ERROR', message: 'Service authentication not configured' },
        })
      }
      keyBuf = Buffer.from(key)
    }

    const provided = req.headers['x-service-key']
    // timingSafeEqual requires same-length buffers — length mismatch is rejected first.
    const providedBuf = provided ? Buffer.from(provided) : null
    const valid = providedBuf &&
      providedBuf.length === keyBuf.length &&
      crypto.timingSafeEqual(providedBuf, keyBuf)
    if (!valid) {
      return res.status(401).json({
        success: false,
        error:   { code: 'UNAUTHORIZED', message: 'Invalid or missing service key' },
      })
    }
    next()
  }
}
