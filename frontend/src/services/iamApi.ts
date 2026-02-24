import axios from 'axios'

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

export interface IamUser {
  user_id: string
  email: string
  status: 'pending' | 'active' | 'locked' | 'disabled'
  registry_id: string | null
  national_id_hash: string | null
  mfa_enabled: boolean
  created_at: string
  updated_at: string
  roles: UserRole[]
}

export interface UserRole {
  role_name: 'Citizen' | 'CaseWorker' | 'ProgrammeManager' | 'Admin' | 'SuperAdmin'
  created_at: string
}

export interface Permission {
  permission_id: string
  permission_key: string
  permission_name: string
  description: string | null
  module: string
  created_at: string
}

export interface IamApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface IamPaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ════════════════════════════════════════════════════════════════════════════
// IAM SERVICE CLIENT
// ════════════════════════════════════════════════════════════════════════════

const IAM_BASE_URL = import.meta.env.VITE_IAM_BASE_URL || ''

const iamClient = axios.create({
  baseURL: IAM_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Request interceptor for auth token
iamClient.interceptors.request.use((config) => {
  // Only add auth header for admin endpoints
  if (config.url?.includes('/admin/')) {
    const storedAuth = localStorage.getItem('spis-auth-storage')
    if (storedAuth) {
      try {
        const parsed = JSON.parse(storedAuth)
        // Fix: Token is stored at state.session.access_token, not state.token
        const token = parsed?.state?.session?.access_token
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      } catch (err) {
        console.error('[iamClient] Parse error:', err)
      }
    }
  }
  
  return config
})

// Response interceptor for error handling
iamClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only logout on 401 if this is an authenticated request (has auth header)
    // Don't logout for 403 (permission denied) - just show error to user
    if (error.response?.status === 401) {
      const hasAuthHeader = error.config?.headers?.Authorization
      if (hasAuthHeader) {
        // Token was invalid/expired - clear session and redirect
        localStorage.removeItem('spis-auth-storage')
        globalThis.location.href = '/login'
      }
    }
    // For 403, let the component handle showing "Access Denied"
    return Promise.reject(error)
  }
)

// ════════════════════════════════════════════════════════════════════════════
// PASSWORD RESET API (Public - no auth required)
// ════════════════════════════════════════════════════════════════════════════

export interface PasswordResetRequestPayload {
  national_id: string
}

export interface PasswordResetRequestResponse {
  success: boolean
  message: string
  otp_id: string
}

export interface PasswordResetConfirmPayload {
  national_id: string
  otp: string
  new_password: string
}

export interface PasswordResetConfirmResponse {
  success: boolean
  message: string
  user_id: string
}

/**
 * Request OTP for password reset by national ID
 */
export async function requestPasswordReset(
  nationalId: string,
): Promise<PasswordResetRequestResponse> {
  const response = await iamClient.post<PasswordResetRequestResponse>(
    '/iam/password-reset/request',
    { national_id: normalizeNationalId(nationalId) },
  )
  return response.data
}

/**
 * Confirm password reset with OTP and new password
 */
export async function confirmPasswordReset(
  nationalId: string,
  otp: string,
  newPassword: string,
): Promise<PasswordResetConfirmResponse> {
  const response = await iamClient.post<PasswordResetConfirmResponse>(
    '/iam/password-reset/confirm',
    {
      national_id: normalizeNationalId(nationalId),
      otp,
      new_password: newPassword,
    },
  )
  return response.data
}

// ════════════════════════════════════════════════════════════════════════════
// USERS ADMIN API (Requires Admin role)
// ════════════════════════════════════════════════════════════════════════════

export interface ListUsersParams {
  page?: number
  limit?: number
  status?: string
  role?: string
  search?: string
}

export const usersApi = {
  /**
   * List all users with optional filters (Admin only)
   */
  list: async (params: ListUsersParams = {}): Promise<IamPaginatedResponse<IamUser>> => {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.set('page', String(params.page))
    if (params.limit) queryParams.set('limit', String(params.limit))
    if (params.status) queryParams.set('status', params.status)
    if (params.role) queryParams.set('role', params.role)
    if (params.search) queryParams.set('search', params.search)
    
    const response = await iamClient.get(`/iam/admin/users?${queryParams}`)
    return response.data
  },
  
  /**
   * Get a single user by ID (Admin only)
   */
  getById: async (userId: string): Promise<IamApiResponse<IamUser>> => {
    const response = await iamClient.get(`/iam/admin/users/${userId}`)
    return response.data
  },
  
  /**
   * Update user details (Admin only)
   */
  update: async (userId: string, data: Partial<IamUser>): Promise<IamApiResponse<IamUser>> => {
    const response = await iamClient.put(`/iam/admin/users/${userId}`, data)
    return response.data
  },
  
  /**
   * Update user roles (Admin only)
   */
  updateRoles: async (userId: string, roles: string[]): Promise<IamApiResponse<{ user_id: string; roles: string[] }>> => {
    const response = await iamClient.put(`/iam/admin/users/${userId}/roles`, { roles })
    return response.data
  },
  
  /**
   * Disable a user (Admin only)
   */
  disable: async (userId: string): Promise<IamApiResponse<IamUser>> => {
    const response = await iamClient.post(`/iam/admin/users/${userId}/disable`)
    return response.data
  },
  
  /**
   * Enable a user (Admin only)
   */
  enable: async (userId: string): Promise<IamApiResponse<IamUser>> => {
    const response = await iamClient.post(`/iam/admin/users/${userId}/enable`)
    return response.data
  },
  
  /**
   * Force password reset (Admin only)
   */
  forcePasswordReset: async (userId: string): Promise<IamApiResponse<{ message: string }>> => {
    const response = await iamClient.post(`/iam/admin/users/${userId}/reset-password`)
    return response.data
  },
}

// ════════════════════════════════════════════════════════════════════════════
// ROLES API
// ════════════════════════════════════════════════════════════════════════════

export interface RoleWithPermissions {
  role: string
  permissions: string[]  // Array of permission keys
  details: Permission[]  // Full permission objects
}

export interface RoleInfo {
  role_id: string
  role_name: string
  display_name: string
  description: string | null
  role_type: 'system' | 'custom'
  is_active: boolean
  user_count?: number
  permission_count?: number
}

export const rolesApi = {
  /**
   * Get all available roles with details
   */
  list: async (): Promise<IamApiResponse<RoleInfo[]>> => {
    const response = await iamClient.get('/iam/admin/roles')
    return response.data
  },
  
  /**
   * Get role with its permissions
   */
  getWithPermissions: async (roleName: string): Promise<IamApiResponse<RoleWithPermissions>> => {
    const response = await iamClient.get(`/iam/admin/roles/${encodeURIComponent(roleName)}/permissions`)
    return response.data
  },
  
  /**
   * Grant a permission to a role
   */
  grantPermission: async (roleName: string, permissionKey: string): Promise<IamApiResponse<{ message: string }>> => {
    const response = await iamClient.post(`/iam/admin/roles/${encodeURIComponent(roleName)}/permissions`, {
      permission_key: permissionKey,
    })
    return response.data
  },
  
  /**
   * Revoke a permission from a role
   */
  revokePermission: async (roleName: string, permissionKey: string): Promise<IamApiResponse<{ message: string }>> => {
    const response = await iamClient.delete(
      `/iam/admin/roles/${encodeURIComponent(roleName)}/permissions/${encodeURIComponent(permissionKey)}`
    )
    return response.data
  },
}

// ════════════════════════════════════════════════════════════════════════════
// PERMISSIONS API
// ════════════════════════════════════════════════════════════════════════════

export interface PermissionsByModule {
  [module: string]: Permission[]
}

export const permissionsApi = {
  /**
   * Get all permissions
   */
  list: async (): Promise<IamApiResponse<{ permissions: Permission[]; byModule: PermissionsByModule }>> => {
    const response = await iamClient.get('/iam/admin/permissions')
    return response.data
  },
  
  /**
   * Get permissions for a specific module
   */
  getByModule: async (module: string): Promise<IamApiResponse<Permission[]>> => {
    const response = await iamClient.get(`/iam/admin/permissions/module/${encodeURIComponent(module)}`)
    return response.data
  },
}

// ════════════════════════════════════════════════════════════════════════════
// AUDIT LOGS API
// ════════════════════════════════════════════════════════════════════════════

export interface AuditLog {
  log_id: string
  user_id: string
  user_email?: string
  action: string
  resource_type: string
  resource_id: string | null
  details: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface ListAuditLogsParams {
  page?: number
  limit?: number
  user_id?: string
  action?: string
  resource_type?: string
  from_date?: string
  to_date?: string
}

export const auditLogsApi = {
  /**
   * List audit logs (Admin only)
   */
  list: async (params: ListAuditLogsParams = {}): Promise<IamPaginatedResponse<AuditLog>> => {
    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.set(key, String(value))
      }
    })
    
    const response = await iamClient.get(`/iam/admin/audit-logs?${queryParams}`)
    return response.data
  },
}

// ════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════════════════════

function normalizeNationalId(value: string): string {
  return value.replace(/\D/g, '')
}

export default iamClient
