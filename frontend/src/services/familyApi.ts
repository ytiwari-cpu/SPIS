import axios, { AxiosError } from 'axios'
import type {
  ApiResponse,
  PaginatedResponse,
  DbFamily,
  DbFamilyWithDetails,
  DbFamilyMember,
  DbAddress,
  DbDocument,
  AuthSession,
  FamilyListItem,
  FamilyRegistrationData,
} from '@/types/database'

// ════════════════════════════════════════════════════════════════════════════
// API CLIENT CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════

const API_BASE_URL = 'http://localhost:3001'

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Request interceptor - add family_id header for authenticated requests
api.interceptors.request.use((config) => {
  const authData = localStorage.getItem('spis-auth')
  if (authData) {
    try {
      const session = JSON.parse(authData) as AuthSession
      if (session.family_id) {
        config.headers['X-Family-ID'] = session.family_id
      }
    } catch {
      // Invalid auth data
    }
  }
  return config
})

// Response error handler
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('spis-auth')
      globalThis.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ════════════════════════════════════════════════════════════════════════════
// AUTH API
// ════════════════════════════════════════════════════════════════════════════

export const authApi = {
  /**
   * Login with family_id (dev mode)
   */
  login: async (familyId: string): Promise<ApiResponse<AuthSession>> => {
    const response = await api.post<ApiResponse<AuthSession>>('/auth/login', {
      family_id: familyId,
    })
    return response.data
  },

  /**
   * Get current authenticated family details
   */
  getMe: async (): Promise<ApiResponse<DbFamilyWithDetails>> => {
    const response = await api.get<ApiResponse<DbFamilyWithDetails>>('/auth/me')
    return response.data
  },

  /**
   * List all families (dev mode only)
   */
  listFamilies: async (): Promise<ApiResponse<FamilyListItem[]>> => {
    const response = await api.get<ApiResponse<FamilyListItem[]>>('/auth/families')
    return response.data
  },

  /**
   * Logout
   */
  logout: async (): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/logout')
    return response.data
  },
}

// ════════════════════════════════════════════════════════════════════════════
// FAMILY API
// ════════════════════════════════════════════════════════════════════════════

export const familyApi = {
  /**
   * Get all families with pagination
   */
  list: async (params?: {
    page?: number
    limit?: number
    status?: string
    registration_status?: string
  }): Promise<PaginatedResponse<DbFamily>> => {
    const response = await api.get<PaginatedResponse<DbFamily>>('/families', { params })
    return response.data
  },

  /**
   * Get single family with full details (members, address, documents)
   */
  getById: async (familyId: string): Promise<ApiResponse<DbFamilyWithDetails>> => {
    const response = await api.get<ApiResponse<DbFamilyWithDetails>>(`/families/${familyId}`)
    return response.data
  },

  /**
   * Create new family with head member and optional address
   */
  create: async (data: FamilyRegistrationData): Promise<ApiResponse<DbFamilyWithDetails>> => {
    const response = await api.post<ApiResponse<DbFamilyWithDetails>>('/families', data)
    return response.data
  },

  /**
   * Update family details
   */
  update: async (familyId: string, data: Partial<DbFamily>): Promise<ApiResponse<DbFamily>> => {
    const response = await api.put<ApiResponse<DbFamily>>(`/families/${familyId}`, data)
    return response.data
  },

  /**
   * Submit family for verification
   */
  submit: async (familyId: string): Promise<ApiResponse<DbFamily>> => {
    const response = await api.post<ApiResponse<DbFamily>>(`/families/${familyId}/submit`)
    return response.data
  },

  /**
   * Delete family (admin only)
   */
  delete: async (familyId: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    const response = await api.delete<ApiResponse<{ deleted: boolean }>>(`/families/${familyId}`)
    return response.data
  },
}

// ════════════════════════════════════════════════════════════════════════════
// FAMILY MEMBERS API
// ════════════════════════════════════════════════════════════════════════════

export const memberApi = {
  /**
   * Get all members for a family
   */
  listByFamily: async (familyId: string): Promise<ApiResponse<DbFamilyMember[]>> => {
    const response = await api.get<ApiResponse<DbFamilyMember[]>>(`/members/family/${familyId}`)
    return response.data
  },

  /**
   * Get single member by ID
   */
  getById: async (memberId: string): Promise<ApiResponse<DbFamilyMember>> => {
    const response = await api.get<ApiResponse<DbFamilyMember>>(`/members/${memberId}`)
    return response.data
  },

  /**
   * Create new family member
   */
  create: async (data: Partial<DbFamilyMember>): Promise<ApiResponse<DbFamilyMember>> => {
    const response = await api.post<ApiResponse<DbFamilyMember>>('/members', data)
    return response.data
  },

  /**
   * Update member details
   */
  update: async (memberId: string, data: Partial<DbFamilyMember>): Promise<ApiResponse<DbFamilyMember>> => {
    const response = await api.put<ApiResponse<DbFamilyMember>>(`/members/${memberId}`, data)
    return response.data
  },

  /**
   * Delete member
   */
  delete: async (memberId: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    const response = await api.delete<ApiResponse<{ deleted: boolean }>>(`/members/${memberId}`)
    return response.data
  },
}

// ════════════════════════════════════════════════════════════════════════════
// ADDRESS API
// ════════════════════════════════════════════════════════════════════════════

export const addressApi = {
  /**
   * Get address by ID
   */
  getById: async (addressId: string): Promise<ApiResponse<DbAddress>> => {
    const response = await api.get<ApiResponse<DbAddress>>(`/addresses/${addressId}`)
    return response.data
  },

  /**
   * Create new address
   */
  create: async (data: Partial<DbAddress>): Promise<ApiResponse<DbAddress>> => {
    const response = await api.post<ApiResponse<DbAddress>>('/addresses', data)
    return response.data
  },

  /**
   * Update address
   */
  update: async (addressId: string, data: Partial<DbAddress>): Promise<ApiResponse<DbAddress>> => {
    const response = await api.put<ApiResponse<DbAddress>>(`/addresses/${addressId}`, data)
    return response.data
  },

  /**
   * Delete address
   */
  delete: async (addressId: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    const response = await api.delete<ApiResponse<{ deleted: boolean }>>(`/addresses/${addressId}`)
    return response.data
  },
}

// ════════════════════════════════════════════════════════════════════════════
// DOCUMENTS API
// ════════════════════════════════════════════════════════════════════════════

export const documentApi = {
  /**
   * Get documents by owner (family or member)
   */
  listByOwner: async (ownerType: 'family' | 'member', ownerId: string): Promise<ApiResponse<DbDocument[]>> => {
    const response = await api.get<ApiResponse<DbDocument[]>>(`/documents/${ownerType}/${ownerId}`)
    return response.data
  },

  /**
   * Get single document
   */
  getById: async (documentId: string): Promise<ApiResponse<DbDocument>> => {
    const response = await api.get<ApiResponse<DbDocument>>(`/documents/${documentId}`)
    return response.data
  },

  /**
   * Upload document
   */
  upload: async (data: FormData): Promise<ApiResponse<DbDocument>> => {
    const response = await api.post<ApiResponse<DbDocument>>('/documents', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  /**
   * Delete document
   */
  delete: async (documentId: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    const response = await api.delete<ApiResponse<{ deleted: boolean }>>(`/documents/${documentId}`)
    return response.data
  },
}

// ════════════════════════════════════════════════════════════════════════════
// DEV API (Development tools)
// ════════════════════════════════════════════════════════════════════════════

export const devApi = {
  /**
   * Get health status
   */
  health: async (): Promise<{ status: string; database: string }> => {
    const response = await api.get<{ status: string; database: string }>('/health'.replace('/api/v1', ''))
    return response.data
  },

  /**
   * Get schema info
   */
  schema: async (): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await api.get<ApiResponse<Record<string, unknown>>>('/dev/schema')
    return response.data
  },

  /**
   * Seed sample data
   */
  seed: async (): Promise<ApiResponse<{ family: DbFamily; head_member: DbFamilyMember; address: DbAddress }>> => {
    const response = await api.post<ApiResponse<{ family: DbFamily; head_member: DbFamilyMember; address: DbAddress }>>('/dev/seed')
    return response.data
  },

  /**
   * Get table data
   */
  getTable: async (tableName: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Record<string, unknown>>> => {
    const response = await api.get<PaginatedResponse<Record<string, unknown>>>(`/dev/table/${tableName}`, { params })
    return response.data
  },

  /**
   * Execute SQL (dev only)
   */
  executeSql: async (query: string): Promise<ApiResponse<unknown>> => {
    const response = await api.post<ApiResponse<unknown>>('/dev/sql', { query })
    return response.data
  },
}

// Default export
export default {
  auth: authApi,
  family: familyApi,
  member: memberApi,
  address: addressApi,
  document: documentApi,
  dev: devApi,
}
