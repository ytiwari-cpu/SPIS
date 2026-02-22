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
 * Paths starting with "/" are prefixed with API_BASE (for family-service).
 * Paths starting with "/iam" are used as-is (for Vite proxy to iam-service).
 * Full URLs are used as-is.
 * 
 * Handles 401 responses by clearing auth and redirecting to login.
 */
export async function authFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  // Determine the URL:
  // - Full URLs (http/https) are used as-is
  // - Paths starting with /iam go through Vite proxy (no prefix)
  // - Other paths get API_BASE prefix
  let url: string
  if (path.startsWith('http')) {
    url = path
  } else if (path.startsWith('/iam')) {
    // IAM service paths go through Vite proxy
    url = path
  } else {
    url = `${API_BASE}${path}`
  }
  
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
