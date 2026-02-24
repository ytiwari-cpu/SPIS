/**
 * RBAC API Service
 * 
 * Handles all Role-Based Access Control API calls to IAM service.
 * - Roles CRUD
 * - Audit Logs
 */

import { authFetch } from './authFetch'

// Use empty string to go through Vite proxy, which forwards /iam/* to localhost:3003
const IAM_BASE_URL = import.meta.env.VITE_IAM_SERVICE_URL || ''

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface RoleRow {
  role_id: string
  role_name: string
  display_name: string
  description: string | null
  role_type: 'system' | 'custom'
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  user_count?: number
  permission_count?: number
}

// Alias for backward compatibility
export interface Role {
  role_name: string
  description: string
  is_system: boolean
  created_at: string
  user_count?: number
  permission_count?: number
}

// Helper to map RoleRow to Role interface
function mapToRole(row: RoleRow): Role {
  return {
    role_name: row.role_name,
    description: row.description || '',
    is_system: row.role_type === 'system',
    created_at: row.created_at,
    user_count: row.user_count,
    permission_count: row.permission_count,
  }
}

export interface CreateRolePayload {
  role_name: string
  display_name: string
  description?: string
}

export interface UpdateRolePayload {
  display_name?: string
  description?: string
  is_active?: boolean
}

export interface AuditLogEntry {
  id: string
  actor_sub: string | null
  actor_email: string | null
  actor_roles: string[] | null
  action: string
  method: string
  path: string
  resource_type: string | null
  resource_id: string | null
  status_code: number
  request_id: string | null
  ip_address: string | null
  user_agent: string | null
  request_summary: Record<string, unknown> | null
  response_summary: Record<string, unknown> | null
  duration_ms: number | null
  created_at: string
}

export interface AuditLogFilters {
  start_date?: string
  end_date?: string
  actor_sub?: string
  action?: string
  resource_type?: string
  status_code?: number
  method?: string
  page?: number
  limit?: number
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ═══════════════════════════════════════════════════════════════
// ROLES API
// ═══════════════════════════════════════════════════════════════

/**
 * Get all roles with metadata (returns Role[] for backward compatibility)
 * @param isActive - Filter by active status (default: true)
 */
export async function getRoles(isActive: boolean = true): Promise<Role[]> {
  const response = await authFetch(`${IAM_BASE_URL}/iam/admin/roles?is_active=${isActive}`)
  const json = await response.json()
  
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to fetch roles')
  }
  
  return (json.data as RoleRow[]).map(mapToRole)
}

/**
 * Get all roles as RoleRow objects (full details)
 * @param isActive - Filter by active status (default: true)
 */
export async function getRoleRows(isActive: boolean = true): Promise<RoleRow[]> {
  const response = await authFetch(`${IAM_BASE_URL}/iam/admin/roles?is_active=${isActive}`)
  const json = await response.json()
  
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to fetch roles')
  }
  
  return json.data as RoleRow[]
}

export interface PermissionObject {
  permission_key: string
  permission_name: string
  description: string | null
  module: string
}

/**
 * Get a single role by name (with full permission objects)
 */
export async function getRoleByName(roleName: string): Promise<RoleRow & { permissions: PermissionObject[] }> {
  const response = await authFetch(`${IAM_BASE_URL}/iam/admin/roles/${encodeURIComponent(roleName)}`)
  const json = await response.json()
  
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to fetch role')
  }
  
  return json.data
}

/**
 * Get permissions for a specific role (returns array of permission keys)
 */
export async function getRolePermissions(roleName: string): Promise<string[]> {
  const roleData = await getRoleByName(roleName)
  // Backend returns array of permission objects, extract just the keys
  const permissions = roleData.permissions || []
  return permissions.map((p: { permission_key: string } | string) => 
    typeof p === 'string' ? p : p.permission_key
  )
}

/**
 * Create a new role
 */
export async function createRole(payload: CreateRolePayload): Promise<RoleRow> {
  const response = await authFetch(`${IAM_BASE_URL}/iam/admin/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await response.json()
  
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to create role')
  }
  
  return json.data
}

/**
 * Update an existing role
 */
export async function updateRole(roleName: string, payload: UpdateRolePayload): Promise<RoleRow> {
  const response = await authFetch(`${IAM_BASE_URL}/iam/admin/roles/${encodeURIComponent(roleName)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await response.json()
  
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to update role')
  }
  
  return json.data
}

/**
 * Delete a role (custom roles only) - soft delete
 */
export async function deleteRole(roleName: string): Promise<void> {
  const response = await authFetch(`${IAM_BASE_URL}/iam/admin/roles/${encodeURIComponent(roleName)}`, {
    method: 'DELETE',
  })
  
  // Handle empty body (204) as success
  if (response.status === 204) {
    return
  }
  
  const text = await response.text()
  if (!text) {
    // Empty response with 2xx status is success
    if (response.ok) return
    throw new Error('Failed to delete role')
  }
  
  let json
  try {
    json = JSON.parse(text)
  } catch {
    // If response was ok but not JSON, treat as success
    if (response.ok) return
    throw new Error('Failed to delete role')
  }
  
  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to delete role')
  }
}

/**
 * Restore a soft-deleted role
 */
export async function restoreRole(roleName: string): Promise<void> {
  const response = await authFetch(`${IAM_BASE_URL}/iam/admin/roles/${encodeURIComponent(roleName)}/restore`, {
    method: 'POST',
  })
  
  // Handle empty body (204) as success
  if (response.status === 204) {
    return
  }
  
  const text = await response.text()
  if (!text) {
    // Empty response with 2xx status is success
    if (response.ok) return
    throw new Error('Failed to restore role')
  }
  
  let json
  try {
    json = JSON.parse(text)
  } catch {
    // If response was ok but not JSON, treat as success
    if (response.ok) return
    throw new Error('Failed to restore role')
  }
  
  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to restore role')
  }
}

/**
 * Permanently delete an inactive role (removes from database)
 */
export async function permanentlyDeleteRole(roleName: string): Promise<void> {
  const response = await authFetch(`${IAM_BASE_URL}/iam/admin/roles/${encodeURIComponent(roleName)}/permanent`, {
    method: 'DELETE',
  })
  
  // Handle empty body (204) as success
  if (response.status === 204) {
    return
  }
  
  const text = await response.text()
  if (!text) {
    // Empty response with 2xx status is success
    if (response.ok) return
    throw new Error('Failed to permanently delete role')
  }
  
  let json
  try {
    json = JSON.parse(text)
  } catch {
    // If response was ok but not JSON, treat as success
    if (response.ok) return
    throw new Error('Failed to permanently delete role')
  }
  
  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to permanently delete role')
  }
}

/**
 * Update role permissions
 */
export async function updateRolePermissions(
  roleName: string, 
  permissions: string[]
): Promise<{ added: string[]; removed: string[] }> {
  const response = await authFetch(`${IAM_BASE_URL}/iam/admin/roles/${encodeURIComponent(roleName)}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions }),
  })
  const json = await response.json()
  
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to update permissions')
  }
  
  return json.data
}

// ═══════════════════════════════════════════════════════════════
// AUDIT LOGS API
// ═══════════════════════════════════════════════════════════════

/**
 * Get audit logs with filters and pagination
 */
export async function getAuditLogs(
  filters: AuditLogFilters = {}
): Promise<PaginatedResponse<AuditLogEntry>> {
  const params = new URLSearchParams()
  
  if (filters.start_date) params.append('start_date', filters.start_date)
  if (filters.end_date) params.append('end_date', filters.end_date)
  if (filters.actor_sub) params.append('actor_sub', filters.actor_sub)
  if (filters.action) params.append('action', filters.action)
  if (filters.resource_type) params.append('resource_type', filters.resource_type)
  if (filters.status_code) params.append('status_code', String(filters.status_code))
  if (filters.method) params.append('method', filters.method)
  if (filters.page) params.append('page', String(filters.page))
  if (filters.limit) params.append('limit', String(filters.limit))
  
  const queryString = params.toString()
  const url = `${IAM_BASE_URL}/iam/admin/audit-logs${queryString ? `?${queryString}` : ''}`
  
  const response = await authFetch(url)
  const json = await response.json()
  
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to fetch audit logs')
  }
  
  return {
    success: true,
    data: json.data,
    pagination: json.pagination,
  }
}

/**
 * Export audit logs to CSV
 */
export async function exportAuditLogs(filters: AuditLogFilters = {}): Promise<Blob> {
  const params = new URLSearchParams()
  
  if (filters.start_date) params.append('start_date', filters.start_date)
  if (filters.end_date) params.append('end_date', filters.end_date)
  if (filters.actor_sub) params.append('actor_sub', filters.actor_sub)
  if (filters.action) params.append('action', filters.action)
  if (filters.resource_type) params.append('resource_type', filters.resource_type)
  if (filters.method) params.append('method', filters.method)
  params.append('format', 'csv')
  
  const queryString = params.toString()
  const url = `${IAM_BASE_URL}/iam/admin/audit-logs/export${queryString ? `?${queryString}` : ''}`
  
  const response = await authFetch(url)
  
  if (!response.ok) {
    const json = await response.json()
    throw new Error(json.error?.message || 'Failed to export audit logs')
  }
  
  return response.blob()
}

// ═══════════════════════════════════════════════════════════════
// PERMISSIONS API
// ═══════════════════════════════════════════════════════════════

export interface Permission {
  permission_key: string
  permission_name: string
  description: string | null
  module: string
}

export interface PermissionsResponse {
  permissions: Permission[]
  byModule: Record<string, Permission[]>
}

/**
 * Get all available permissions grouped by module
 */
export async function getAllPermissions(): Promise<PermissionsResponse> {
  const response = await authFetch(`${IAM_BASE_URL}/iam/admin/permissions`)
  const json = await response.json()
  
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to fetch permissions')
  }
  
  // Backend returns a flat array (PermissionRow[]); normalize into PermissionsResponse
  const raw = json.data
  const permissions: Permission[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.permissions)
      ? raw.permissions
      : []

  // Build byModule index
  const byModule: Record<string, Permission[]> = {}
  for (const perm of permissions) {
    const mod = perm.module || perm.permission_key.split('.')[0]
    if (!byModule[mod]) byModule[mod] = []
    byModule[mod].push(perm)
  }

  return { permissions, byModule }
}

/**
 * Get permissions for the current user
 */
export async function getMyPermissions(): Promise<string[]> {
  const response = await authFetch(`${IAM_BASE_URL}/iam/admin/me/permissions`)
  const json = await response.json()
  
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to fetch user permissions')
  }
  
  return json.data?.permissions || []
}
