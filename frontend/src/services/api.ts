import axios from 'axios'
import type {
  ApiResponse,
  PaginatedResponse,
  Family,
  FamilyMember,
  Address,
  Document,
  DocumentVerification,
  DashboardSummary,
  CreateFamilyDraftRequest,
  AddFamilyMemberRequest,
  UpdateAddressRequest,
  SubmitFamilyRegistrationRequest,
} from '@/types'

// ────────────────────────────────────────────────────────────────────────────
// API CLIENT SETUP
// ────────────────────────────────────────────────────────────────────────────

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('spis-auth-storage')
  if (token) {
    try {
      const parsed = JSON.parse(token)
      if (parsed.state?.token) {
        config.headers.Authorization = `Bearer ${parsed.state.token}`
      }
    } catch {
      // Invalid token format
    }
  }
  return config
})

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
      localStorage.removeItem('spis-auth-storage')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ────────────────────────────────────────────────────────────────────────────
// FAMILY API
// ────────────────────────────────────────────────────────────────────────────

export const familyApi = {
  // Dashboard
  getDashboardSummary: async (): Promise<ApiResponse<DashboardSummary>> => {
    const response = await apiClient.get('/family/dashboard')
    return response.data
  },

  // Family CRUD
  createDraft: async (
    data: CreateFamilyDraftRequest
  ): Promise<ApiResponse<Family>> => {
    const response = await apiClient.post('/family/draft', data)
    return response.data
  },

  getFamily: async (familyId: string): Promise<ApiResponse<Family>> => {
    const response = await apiClient.get(`/family/${familyId}`)
    return response.data
  },

  updateFamily: async (
    familyId: string,
    data: Partial<Family>
  ): Promise<ApiResponse<Family>> => {
    const response = await apiClient.patch(`/family/${familyId}`, data)
    return response.data
  },

  submitRegistration: async (
    data: SubmitFamilyRegistrationRequest
  ): Promise<ApiResponse<Family>> => {
    const response = await apiClient.post('/family/submit', data)
    return response.data
  },

  // Members
  getMembers: async (familyId: string): Promise<ApiResponse<FamilyMember[]>> => {
    const response = await apiClient.get(`/family/${familyId}/members`)
    return response.data
  },

  addMember: async (
    data: AddFamilyMemberRequest
  ): Promise<ApiResponse<FamilyMember>> => {
    const response = await apiClient.post(
      `/family/${data.family_id}/members`,
      data
    )
    return response.data
  },

  updateMember: async (
    familyId: string,
    memberId: string,
    data: Partial<FamilyMember>
  ): Promise<ApiResponse<FamilyMember>> => {
    const response = await apiClient.patch(
      `/family/${familyId}/members/${memberId}`,
      data
    )
    return response.data
  },

  markMemberDeceased: async (
    familyId: string,
    memberId: string
  ): Promise<ApiResponse<FamilyMember>> => {
    const response = await apiClient.post(
      `/family/${familyId}/members/${memberId}/deceased`
    )
    return response.data
  },

  // Address
  getAddress: async (familyId: string): Promise<ApiResponse<Address>> => {
    const response = await apiClient.get(`/family/${familyId}/address`)
    return response.data
  },

  updateAddress: async (
    data: UpdateAddressRequest
  ): Promise<ApiResponse<Address>> => {
    const response = await apiClient.put(
      `/family/${data.family_id}/address`,
      data
    )
    return response.data
  },

  // Documents
  getDocuments: async (
    familyId: string
  ): Promise<ApiResponse<(Document & { verification: DocumentVerification })[]>> => {
    const response = await apiClient.get(`/family/${familyId}/documents`)
    return response.data
  },

  uploadDocument: async (
    familyId: string,
    formData: FormData
  ): Promise<ApiResponse<Document>> => {
    const response = await apiClient.post(
      `/family/${familyId}/documents`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    )
    return response.data
  },

  replaceDocument: async (
    familyId: string,
    documentId: string,
    formData: FormData
  ): Promise<ApiResponse<Document>> => {
    const response = await apiClient.put(
      `/family/${familyId}/documents/${documentId}`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    )
    return response.data
  },
}

// ────────────────────────────────────────────────────────────────────────────
// NOTICES API
// ────────────────────────────────────────────────────────────────────────────

import type { PublicNotice, NoticeCategory } from '@/types'

export const noticesApi = {
  getNotices: async (
    category?: NoticeCategory,
    page = 1,
    limit = 10
  ): Promise<PaginatedResponse<PublicNotice>> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (category) params.append('category', category)
    const response = await apiClient.get(`/notices?${params}`)
    return response.data
  },

  getNotice: async (id: string): Promise<ApiResponse<PublicNotice>> => {
    const response = await apiClient.get(`/notices/${id}`)
    return response.data
  },
}

// ────────────────────────────────────────────────────────────────────────────
// PROGRAMMES API (PLACEHOLDER)
// ────────────────────────────────────────────────────────────────────────────

import type { Programme, ProgrammeStatus } from '@/types'

export const programmesApi = {
  getProgrammes: async (
    status?: ProgrammeStatus
  ): Promise<ApiResponse<Programme[]>> => {
    const params = status ? `?status=${status}` : ''
    const response = await apiClient.get(`/programmes${params}`)
    return response.data
  },

  getProgramme: async (id: string): Promise<ApiResponse<Programme>> => {
    const response = await apiClient.get(`/programmes/${id}`)
    return response.data
  },
}

// ────────────────────────────────────────────────────────────────────────────
// BENEFITS API (PLACEHOLDER)
// ────────────────────────────────────────────────────────────────────────────

import type { Benefit } from '@/types'

export const benefitsApi = {
  getBenefits: async (
    page = 1,
    limit = 10
  ): Promise<PaginatedResponse<Benefit>> => {
    const response = await apiClient.get(
      `/benefits?page=${page}&limit=${limit}`
    )
    return response.data
  },

  getBenefitSummary: async (): Promise<
    ApiResponse<{ total_cash: number; pending_count: number }>
  > => {
    const response = await apiClient.get('/benefits/summary')
    return response.data
  },
}

// ────────────────────────────────────────────────────────────────────────────
// GRIEVANCES API (PLACEHOLDER)
// ────────────────────────────────────────────────────────────────────────────

import type { Grievance, GrievanceType } from '@/types'

export const grievancesApi = {
  getGrievances: async (
    page = 1,
    limit = 10
  ): Promise<PaginatedResponse<Grievance>> => {
    const response = await apiClient.get(
      `/grievances?page=${page}&limit=${limit}`
    )
    return response.data
  },

  getGrievance: async (id: string): Promise<ApiResponse<Grievance>> => {
    const response = await apiClient.get(`/grievances/${id}`)
    return response.data
  },

  createGrievance: async (data: {
    programme_id: string
    type: GrievanceType
    reason: string
    supporting_remarks?: string
  }): Promise<ApiResponse<Grievance>> => {
    const response = await apiClient.post('/grievances', data)
    return response.data
  },
}

export default apiClient
