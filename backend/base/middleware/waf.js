/**
 * base/middleware/waf.js
 *
 * Application-level WAF (Web Application Firewall).
 * Blocks suspicious user agents, SQL injection patterns, null bytes,
 * oversized query strings, and invalid content types.
 *
 * Usage:
 *   import { waf } from '../../base/middleware/waf.js'
 *   app.use(waf())
 */

const BLOCKED_AGENTS_RE = /sqlmap|nikto|masscan|zgrab|dirbuster|nmap|wpscan|acunetix|nessus|burp|hydra|metasploit/i

const SQL_INJECT_RE = /('\s*(or|and|union|select|insert|update|delete|drop|truncate|exec|execute|declare)\s)|(--)|(;\/\*)|(\/\*.*?\*\/)|\bxp_|\bexec\b/i

const MAX_QUERY_LENGTH = 2000

const BLOCKED_RESPONSE = { success: false, error: { code: 'BLOCKED', message: 'Request blocked' } }

/**
 * @returns {import('express').RequestHandler}
 */
export function waf() {
  return (req, res, next) => {
    // 1. Block suspicious user agents
    const ua = req.headers['user-agent'] || ''
    if (BLOCKED_AGENTS_RE.test(ua)) {
      return res.status(403).json(BLOCKED_RESPONSE)
    }

    // 2. Content-Type check for write methods (POST/PATCH/PUT only)
    // Skip check when there is no body (Content-Length: 0 or absent) — e.g. action endpoints like /enable
    if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
      const contentLength = parseInt(req.headers['content-length'] || '0', 10)
      const hasBody = contentLength > 0 || req.headers['transfer-encoding']
      if (hasBody) {
        const ct = req.headers['content-type'] || ''
        if (!ct.startsWith('application/json') && !ct.startsWith('multipart/form-data')) {
          return res.status(415).json(BLOCKED_RESPONSE)
        }
      }
    }

    // 3. Reject oversized query strings
    const queryString = req.originalUrl?.split('?')[1] || ''
    if (queryString.length > MAX_QUERY_LENGTH) {
      return res.status(403).json(BLOCKED_RESPONSE)
    }

    // 4. SQL injection pattern in URL
    if (SQL_INJECT_RE.test(req.url)) {
      return res.status(403).json(BLOCKED_RESPONSE)
    }

    // 5. Null byte check in query params
    const hasNullByte = Object.values(req.query).some(v => typeof v === 'string' && v.includes('\x00'))
    if (hasNullByte) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid characters in request' } })
    }

    next()
  }
}
