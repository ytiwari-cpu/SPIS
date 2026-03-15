// base/circuitBreaker.js
import CircuitBreaker from 'opossum'
import { createLogger } from './logger.js'

const log = createLogger('circuit-breaker')

/**
 * Create a circuit breaker around an async function.
 *
 * @param {Function} fn   — async function to protect
 * @param {object} [options]
 * @param {string} [options.name] — label for logs
 * @param {number} [options.timeout] — ms before a call is considered failed (default 3000)
 * @param {number} [options.errorThresholdPercentage] — % failures to open (default 50)
 * @param {number} [options.resetTimeout] — ms before half-open probe (default 30000)
 * @returns {CircuitBreaker}
 */
export function createCircuitBreaker(fn, options = {}) {
  const breaker = new CircuitBreaker(fn, {
    timeout:                  10000,
    errorThresholdPercentage: 50,
    resetTimeout:             30000,
    volumeThreshold:          5,    // require ≥5 requests before the circuit can open
    ...options,
  })
  breaker.fallback(() => null)
  breaker.on('open',     () => log.error('Circuit breaker OPEN',     { fn: options.name || fn.name }))
  breaker.on('close',    () => log.info('Circuit breaker CLOSED',    { fn: options.name || fn.name }))
  breaker.on('halfOpen', () => log.warn('Circuit breaker HALF-OPEN', { fn: options.name || fn.name }))
  breaker.on('failure',  (err) => log.error('Circuit breaker failure', { fn: options.name || fn.name, error: err?.message, code: err?.code }))
  return breaker
}
