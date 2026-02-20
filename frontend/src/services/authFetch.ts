/**
 * Authenticated fetch helper for citizen pages.
 *
 * Reads the JWT access_token from the Zustand-persisted auth store
 * and attaches it as a Bearer token. Also sends X-Family-ID when available.
 */

const API_BASE = 'http://localhost:3001/api/v1'

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  try {
    const raw = sessionStorage.getItem('spis-auth-storage')
    if (raw) {
      const stored = JSON.parse(raw)
      const session = stored.state?.session
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      if (session?.family_id) {
        headers['X-Family-ID'] = session.family_id
      }
    }
  } catch {
    // ignore
  }

  return headers
}

/**
 * Authenticated fetch — wraps native fetch with auth headers.
 * Usage: `const res = await authFetch('/families/uuid-here')`
 *
 * Paths starting with "/" are prefixed with API_BASE.
 * Full URLs are used as-is.
 * 
 * Handles 401 responses by clearing auth and redirecting to login.
 */
export async function authFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const authHeaders = getAuthHeaders()

  const response = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders,
      ...(init?.headers || {}),
    },
  })

  // Handle token expiry
  if (response.status === 401 && !globalThis.location.pathname.includes('/login')) {
    sessionStorage.removeItem('spis-auth-storage')
    globalThis.location.href = '/login'
  }

  return response
}

/**
 * Authenticated file upload — FormData (no Content-Type, browser sets boundary).
 * Handles 401 responses by clearing auth and redirecting to login.
 */
export async function authUpload(
  path: string,
  body: FormData,
  method = 'POST',
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const headers: Record<string, string> = {}

  try {
    const raw = sessionStorage.getItem('spis-auth-storage')
    if (raw) {
      const stored = JSON.parse(raw)
      const session = stored.state?.session
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
    }
  } catch {
    // ignore
  }

  const response = await fetch(url, { method, headers, body })

  // Handle token expiry
  if (response.status === 401 && !globalThis.location.pathname.includes('/login')) {
    sessionStorage.removeItem('spis-auth-storage')
    globalThis.location.href = '/login'
  }

  return response
}

export { API_BASE }
