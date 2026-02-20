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

// Request interceptor - add auth headers for authenticated requests
api.interceptors.request.use((config) => {
  const raw = sessionStorage.getItem('spis-auth-storage')
  if (raw) {
    try {
      const stored = JSON.parse(raw)
      const session = stored.state?.session as AuthSession
      if (session) {
        if (session.family_id) {
          config.headers['X-Family-ID'] = session.family_id
        }
        if (session.access_token) {
          config.headers['Authorization'] = `Bearer ${session.access_token}`
        }
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
      // Only redirect if not already on login page (prevent loops)
      if (!globalThis.location.pathname.includes('/login')) {
        sessionStorage.removeItem('spis-auth-storage')
        globalThis.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// ════════════════════════════════════════════════════════════════════════════
// AUTH API
// ════════════════════════════════════════════════════════════════════════════

export const authApi = {
  /**
   * Login with national_id and password via IAM service
   */
  login: async (credentials: { national_id: string; password: string }): Promise<ApiResponse<AuthSession>> => {
    const response = await api.post<ApiResponse<AuthSession>>('/auth/login', credentials)
    return response.data
  },

  /**
   * Request OTP for login (proxied through family-service to IAM)
   */
  requestOtpLogin: async (nationalId: string): Promise<ApiResponse<{ message: string; otp_id: string; user_exists_in_iam: boolean }>> => {
    const response = await api.post<ApiResponse<{ message: string; otp_id: string; user_exists_in_iam: boolean }>>(
      '/auth/otp-login/request',
      { national_id: nationalId }
    )
    return response.data
  },

  /**
   * Verify OTP and login (proxied through family-service — enriched with family data)
   */
  verifyOtpLogin: async (credentials: { national_id: string; otp: string }): Promise<ApiResponse<AuthSession>> => {
    const response = await api.post<ApiResponse<AuthSession>>(
      '/auth/otp-login/verify',
      credentials
    )
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

// Default export
export default {
  auth: authApi,
  family: familyApi,
  member: memberApi,
  address: addressApi,
  document: documentApi,
}
