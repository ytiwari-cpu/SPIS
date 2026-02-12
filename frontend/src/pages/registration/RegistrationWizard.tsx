/**
 * FAMILY REGISTRATION WIZARD
 * 
 * DB-DRIVEN FLOW (MANDATORY ORDER):
 * 
 * Step 1: FAMILY DETAILS + ADDRESS (root entity + address - created first)
 * Step 2: FAMILY MEMBERS (count = household_size, NO per-member doc upload)
 * Step 3: DOCUMENT UPLOADS (unified — select holder + type + upload)
 * Step 4: REVIEW & SUBMIT
 * 
 * RULES:
 * - Family is created FIRST (generates family_id)
 * - All subsequent steps reference family_id
 * - NO mock data, NO skipped steps
 * - All data persisted to database via API
 * - File uploads use FormData → /api/v1/upload/ (multer)
 * - Documents are uploaded in a SINGLE unified step with holder/type dropdowns
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import AddressAutocomplete from '@/components/AddressAutocomplete'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface FamilyData {
  uuid: string
  family_id: string
  household_size: number
  intake_channel: string
  geo_code?: string
  vulnerability_flag: boolean
  status: string
  registration_status: string
  permanent_address_id?: string
  head_member_id?: string
  head_first_name?: string
  head_last_name?: string
}

interface AddressData {
  address_id?: string
  line1: string
  line2?: string
  parish: string
  district: string
  geo_code?: string
}

interface MemberData {
  member_id?: string
  uuid?: string
  national_id?: string
  first_name: string
  last_name: string
  date_of_birth?: string
  gender?: 'male' | 'female' | 'other'
  relationship_to_head: string
  marital_status?: string
  alive_flag: boolean
  use_family_address: boolean
  current_address?: AddressData
  phone?: string
  email?: string
}

interface WizardState {
  currentStep: number
  familyUuid: string | null
  familyId: string | null
  family: FamilyData | null
  address: AddressData | null
  members: MemberData[]
  currentMemberIndex: number
  isLoading: boolean
  error: string | null
}

interface UploadedDoc {
  document_id: string
  document_type: string
  file_name: string
  file_url?: string
  mime_type?: string
  owner_type: string
  owner_id: string
}

// ═══════════════════════════════════════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE = 'http://localhost:3001/api/v1/registration'
const UPLOAD_API = 'http://localhost:3001/api/v1/upload'

async function apiCall<T>(
  endpoint: string, 
  method: 'GET' | 'POST' | 'PUT' = 'GET',
  body?: Record<string, unknown>
): Promise<{ success: boolean; data?: T; error?: string; message?: string }> {
  try {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    if (body) {
      options.body = JSON.stringify(body)
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, options)
    const result = await response.json()
    return result
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Network error' 
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: FAMILY DETAILS + ADDRESS
// ═══════════════════════════════════════════════════════════════════════════

function Step1FamilyAndAddress({ 
  onNext, 
  isLoading, 
  error 
}: { 
  onNext: (data: { 
    household_size: number
    intake_channel: string
    head_first_name: string
    head_last_name: string
    phone?: string
    email?: string
    geo_code?: string
    vulnerability_flag: boolean
    address: AddressData 
  }) => void
  isLoading: boolean
  error: string | null
}) {
  const [formData, setFormData] = useState({
    household_size: 1,
    intake_channel: 'web_portal',
    head_first_name: '',
    head_last_name: '',
    phone: '',
    email: '',
    geo_code: '',
    vulnerability_flag: false,
    address: {
      line1: '',
      line2: '',
      parish: '',
      district: '',
      geo_code: '',
    } as AddressData,
  })

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const validateEmail = (email: string): boolean => {
    if (!email) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const errors: Record<string, string> = {}
    
    if (!formData.head_first_name.trim()) {
      errors.head_first_name = 'First name is required'
    }
    if (!formData.head_last_name.trim()) {
      errors.head_last_name = 'Last name is required'
    }
    if (formData.email && !validateEmail(formData.email)) {
      errors.email = 'Invalid email format'
    }
    if (!formData.address.line1.trim()) {
      errors.line1 = 'Address line 1 is required'
    }
    if (!formData.address.district.trim()) {
      errors.district = 'District is required'
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    setValidationErrors({})
    onNext(formData)
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Step 1: Family Details & Address
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Enter primary contact information and permanent address
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PRIMARY CONTACT SECTION */}
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg space-y-4">
          <h3 className="font-bold text-purple-900 dark:text-purple-200 flex items-center gap-2">
            <span className="material-symbols-outlined">person</span>
            Primary Contact (Head of Household)
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="head_first_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                First Name *
              </label>
              <input
                id="head_first_name"
                type="text"
                value={formData.head_first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, head_first_name: e.target.value }))}
                className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 ${validationErrors.head_first_name ? 'border-red-500' : ''}`}
                required
              />
              {validationErrors.head_first_name && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.head_first_name}</p>
              )}
            </div>

            <div>
              <label htmlFor="head_last_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last Name *
              </label>
              <input
                id="head_last_name"
                type="text"
                value={formData.head_last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, head_last_name: e.target.value }))}
                className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 ${validationErrors.head_last_name ? 'border-red-500' : ''}`}
                required
              />
              {validationErrors.head_last_name && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.head_last_name}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                value={formData.phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setFormData(prev => ({ ...prev, phone: digits }))
                }}
                placeholder="10-digit phone number"
                maxLength={10}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">10 digits only (without country code)</p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="name@example.com"
                className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 ${validationErrors.email ? 'border-red-500' : ''}`}
              />
              {validationErrors.email && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
              )}
            </div>
          </div>
        </div>

        {/* FAMILY SECTION */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-4">
          <h3 className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
            <span className="material-symbols-outlined">family_restroom</span>
            Family Details
          </h3>
          
          <div>
            <label htmlFor="household_size" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Household Size *
            </label>
            <input
              id="household_size"
              type="number"
              min="1"
              max="50"
              value={formData.household_size}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                household_size: Number.parseInt(e.target.value) || 1 
              }))}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Total number of family members (you will add each member later)
            </p>
          </div>

          <div>
            <label htmlFor="intake_channel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Registration Channel *
            </label>
            <select
              id="intake_channel"
              value={formData.intake_channel}
              onChange={(e) => setFormData(prev => ({ ...prev, intake_channel: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              required
            >
              <option value="web_portal">Web Portal</option>
              <option value="mobile_app">Mobile App</option>
              <option value="field_registration">Field Registration</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="vulnerability_flag"
              type="checkbox"
              checked={formData.vulnerability_flag}
              onChange={(e) => setFormData(prev => ({ ...prev, vulnerability_flag: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300"
            />
            <label htmlFor="vulnerability_flag" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Mark as vulnerable household
            </label>
          </div>
        </div>

        {/* ADDRESS SECTION */}
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg space-y-4">
          <h3 className="font-bold text-green-900 dark:text-green-200 flex items-center gap-2">
            <span className="material-symbols-outlined">home</span>
            Permanent Address
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search Address (Jamaica only)
            </label>
            <AddressAutocomplete
              onSelect={(data) => {
                setFormData(prev => ({
                  ...prev,
                  address: {
                    ...prev.address,
                    line1: data.line1 || prev.address.line1,
                    parish: data.parish || prev.address.parish,
                    district: data.district || prev.address.district,
                    geo_code: data.geo_code || prev.address.geo_code,
                  }
                }))
              }}
              placeholder="Start typing to search for an address in Jamaica..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Select an address to auto-fill the fields below, or enter manually
            </p>
          </div>

          <div>
            <label htmlFor="line1" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address Line 1 *
            </label>
            <input
              id="line1"
              type="text"
              value={formData.address.line1}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                address: { ...prev.address, line1: e.target.value } 
              }))}
              placeholder="Street address, house number"
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              required
            />
          </div>

          <div>
            <label htmlFor="line2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address Line 2
            </label>
            <input
              id="line2"
              type="text"
              value={formData.address.line2 || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                address: { ...prev.address, line2: e.target.value } 
              }))}
              placeholder="Apartment, suite, etc."
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="parish" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Parish/Ward
              </label>
              <input
                id="parish"
                type="text"
                value={formData.address.parish}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  address: { ...prev.address, parish: e.target.value } 
                }))}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              />
            </div>

            <div>
              <label htmlFor="district" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                District *
              </label>
              <input
                id="district"
                type="text"
                value={formData.address.district}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  address: { ...prev.address, district: e.target.value } 
                }))}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                required
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              Creating Family...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">arrow_forward</span>
              Create Family & Continue
            </>
          )}
        </button>
      </form>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: FAMILY MEMBERS (NO document upload per member)
// ═══════════════════════════════════════════════════════════════════════════

function Step2Members({ 
  familyUuid,
  householdSize,
  membersAdded,
  onMemberAdded,
  onNext, 
  onBack,
  isLoading, 
  error 
}: { 
  familyUuid: string
  householdSize: number
  membersAdded: number
  onMemberAdded: (member: MemberData) => void
  onNext: () => void
  onBack: () => void
  isLoading: boolean
  error: string | null
}) {
  const [formData, setFormData] = useState<MemberData>({
    first_name: '',
    last_name: '',
    national_id: '',
    date_of_birth: '',
    gender: undefined,
    relationship_to_head: membersAdded === 0 ? 'head' : '',
    marital_status: '',
    alive_flag: true,
    use_family_address: false,
    phone: '',
    email: '',
    current_address: {
      line1: '',
      line2: '',
      parish: '',
      district: '',
    },
  })

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const remaining = householdSize - membersAdded

  const validateNationalId = (nid: string): boolean => {
    if (!nid) return true
    const digits = nid.replace(/\D/g, '')
    return digits.length === 14
  }

  const validateEmail = (email: string): boolean => {
    if (!email) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const errors: Record<string, string> = {}
    
    if (formData.national_id && !validateNationalId(formData.national_id)) {
      errors.national_id = 'National ID must be exactly 14 digits'
    }
    if (formData.email && !validateEmail(formData.email)) {
      errors.email = 'Invalid email format'
    }
    
    if (!formData.use_family_address) {
      if (!formData.current_address?.line1) {
        errors.address_line1 = 'Address line 1 is required'
      }
      if (!formData.current_address?.district) {
        errors.address_district = 'District is required'
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }
    
    setValidationErrors({})
    
    const memberPayload = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      national_id: formData.national_id,
      date_of_birth: formData.date_of_birth,
      gender: formData.gender,
      relationship_to_head: formData.relationship_to_head,
      marital_status: formData.marital_status,
      alive_flag: formData.alive_flag,
      phone: formData.phone,
      email: formData.email,
      use_family_address: formData.use_family_address,
      current_address: formData.use_family_address ? undefined : formData.current_address,
    }
    
    const result = await apiCall<{ uuid: string; member_id: string }>(`/family/${familyUuid}/members`, 'POST', memberPayload)

    if (result.success && result.data) {
      const memberResult = result.data as { uuid: string; member_id: string }
      // Immediately pass member data back — no docs phase
      const memberData = { ...formData, member_id: memberResult.member_id, uuid: memberResult.uuid }
      onMemberAdded(memberData)

      // Reset for next member
      const newMemberCount = membersAdded + 1
      if (newMemberCount < householdSize) {
        setFormData({
          first_name: '',
          last_name: '',
          national_id: '',
          date_of_birth: '',
          gender: undefined,
          relationship_to_head: '',
          marital_status: '',
          alive_flag: true,
          use_family_address: false,
          phone: '',
          email: '',
          current_address: { line1: '', line2: '', parish: '', district: '' },
        })
        setValidationErrors({})
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Step 2: Family Members
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Adding member {membersAdded + 1} of {householdSize}
        </p>
        <div className="flex items-center justify-center gap-2 mt-3">
          {Array.from({ length: householdSize }).map((_, i) => (
            <div
              key={i}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i < membersAdded
                  ? 'bg-green-500 text-white'
                  : i === membersAdded
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }`}
            >
              {i < membersAdded ? '✓' : i + 1}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              First Name *
            </label>
            <input
              id="first_name"
              type="text"
              value={formData.first_name}
              onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              required
            />
          </div>
          <div>
            <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Last Name *
            </label>
            <input
              id="last_name"
              type="text"
              value={formData.last_name}
              onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="national_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            National ID (14 digits)
          </label>
          <input
            id="national_id"
            type="text"
            inputMode="numeric"
            value={formData.national_id || ''}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 14)
              setFormData(prev => ({ ...prev, national_id: digits }))
            }}
            placeholder="Enter 14-digit National ID"
            maxLength={14}
            className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 ${validationErrors.national_id ? 'border-red-500' : ''}`}
          />
          {validationErrors.national_id && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.national_id}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">Must be exactly 14 digits</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="member_phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number
            </label>
            <input
              id="member_phone"
              type="tel"
              inputMode="numeric"
              value={formData.phone || ''}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                setFormData(prev => ({ ...prev, phone: digits }))
              }}
              placeholder="10-digit phone number"
              maxLength={10}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">10 digits only (without country code)</p>
          </div>
          <div>
            <label htmlFor="member_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              id="member_email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="name@example.com"
              className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 ${validationErrors.email ? 'border-red-500' : ''}`}
            />
            {validationErrors.email && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date of Birth
            </label>
            <input
              id="date_of_birth"
              type="date"
              value={formData.date_of_birth || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
            />
          </div>
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gender
            </label>
            <select
              id="gender"
              value={formData.gender || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as MemberData['gender'] }))}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="relationship" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Relationship to Head *
            </label>
            <select
              id="relationship"
              value={formData.relationship_to_head}
              onChange={(e) => setFormData(prev => ({ ...prev, relationship_to_head: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              required
            >
              <option value="">Select...</option>
              <option value="head">Head of Household</option>
              <option value="spouse">Spouse</option>
              <option value="child">Child</option>
              <option value="parent">Parent</option>
              <option value="sibling">Sibling</option>
              <option value="grandparent">Grandparent</option>
              <option value="grandchild">Grandchild</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="marital_status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Marital Status
            </label>
            <select
              id="marital_status"
              value={formData.marital_status || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, marital_status: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="">Select...</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
              <option value="separated">Separated</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="use_family_address"
            type="checkbox"
            checked={formData.use_family_address}
            onChange={(e) => setFormData(prev => ({ ...prev, use_family_address: e.target.checked }))}
            className="w-5 h-5 rounded"
          />
          <label htmlFor="use_family_address" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Same address as family permanent address
          </label>
        </div>

        {!formData.use_family_address && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-4">
            <h4 className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <span className="material-symbols-outlined">location_on</span>
              Member&apos;s Current Address
            </h4>
            <div>
              <label htmlFor="member_line1" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Address Line 1 *
              </label>
              <input
                id="member_line1"
                type="text"
                value={formData.current_address?.line1 || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  current_address: { ...prev.current_address!, line1: e.target.value } 
                }))}
                placeholder="Street address"
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                required={!formData.use_family_address}
              />
            </div>
            <div>
              <label htmlFor="member_line2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Address Line 2
              </label>
              <input
                id="member_line2"
                type="text"
                value={formData.current_address?.line2 || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  current_address: { ...prev.current_address!, line2: e.target.value } 
                }))}
                placeholder="Apartment, suite, etc."
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="member_parish" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Parish/Ward
                </label>
                <input
                  id="member_parish"
                  type="text"
                  value={formData.current_address?.parish || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    current_address: { ...prev.current_address!, parish: e.target.value } 
                  }))}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                />
              </div>
              <div>
                <label htmlFor="member_district" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  District *
                </label>
                <input
                  id="member_district"
                  type="text"
                  value={formData.current_address?.district || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    current_address: { ...prev.current_address!, district: e.target.value } 
                  }))}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  required={!formData.use_family_address}
                />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 px-4 border border-gray-300 rounded-lg"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-3 px-4 bg-primary text-white rounded-lg font-medium disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : remaining > 1 ? `Save Member (${remaining} left)` : 'Save Last Member'}
          </button>
        </div>

        {membersAdded === householdSize && (
          <button
            type="button"
            onClick={onNext}
            className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-medium"
          >
            All Members Added — Continue to Documents
          </button>
        )}
      </form>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: UNIFIED DOCUMENT UPLOADS
// Single step with holder dropdown (Family / Member1 / Member2…) + type dropdown
// ═══════════════════════════════════════════════════════════════════════════

const ALL_DOC_TYPES = [
  { value: 'proof_of_address', label: 'Proof of Address' },
  { value: 'income_statement', label: 'Income Statement' },
  { value: 'utility_bill', label: 'Utility Bill' },
  { value: 'national_id', label: 'National ID' },
  { value: 'birth_certificate', label: 'Birth Certificate' },
  { value: 'passport', label: 'Passport' },
  { value: 'profile_photo', label: 'Profile Photo' },
  { value: 'marriage_certificate', label: 'Marriage Certificate' },
  { value: 'death_certificate', label: 'Death Certificate' },
  { value: 'other', label: 'Other' },
]

interface HolderOption {
  label: string
  ownerType: 'family' | 'member'
  ownerId: string
}

function Step3Documents({
  familyUuid,
  familyId,
  members,
  onNext,
  onBack,
  isLoading,
  error,
}: {
  familyUuid: string
  familyId: string
  members: MemberData[]
  onNext: () => void
  onBack: () => void
  isLoading: boolean
  error: string | null
}) {
  const [selectedType, setSelectedType] = useState(ALL_DOC_TYPES[0].value)
  const [selectedHolder, setSelectedHolder] = useState(0)
  const [uploads, setUploads] = useState<UploadedDoc[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [loadingDocs, setLoadingDocs] = useState(true)

  // Build holder options from family + members
  const holderOptions: HolderOption[] = [
    { label: `Family — ${familyId}`, ownerType: 'family', ownerId: familyUuid },
    ...members.map(m => {
      const headTag = m.relationship_to_head === 'head' ? ' (Head)' : ''
      return {
        label: `Member — ${m.first_name} ${m.last_name}${headTag}`,
        ownerType: 'member' as const,
        ownerId: m.uuid || m.member_id || '',
      }
    }),
  ]

  // Load already-uploaded documents on mount
  useEffect(() => {
    const loadDocs = async () => {
      setLoadingDocs(true)
      const allDocs: UploadedDoc[] = []

      try {
        // Family docs
        const famRes = await fetch(`http://localhost:3001/api/v1/documents/family/${familyUuid}`)
        const famJson = await famRes.json()
        if (famJson.success && famJson.data) {
          for (const d of famJson.data) {
            allDocs.push({
              document_id: d.document_id,
              document_type: d.document_type,
              file_name: d.file_name || 'Unknown',
              file_url: d.file_url,
              mime_type: d.mime_type,
              owner_type: 'FAMILY',
              owner_id: familyUuid,
            })
          }
        }

        // Member docs
        for (const m of members) {
          const mId = m.uuid || m.member_id
          if (!mId) continue
          const memRes = await fetch(`http://localhost:3001/api/v1/documents/member/${mId}`)
          const memJson = await memRes.json()
          if (memJson.success && memJson.data) {
            for (const d of memJson.data) {
              allDocs.push({
                document_id: d.document_id,
                document_type: d.document_type,
                file_name: d.file_name || 'Unknown',
                file_url: d.file_url,
                mime_type: d.mime_type,
                owner_type: 'MEMBER',
                owner_id: mId,
              })
            }
          }
        }
      } catch {
        // ignore load errors
      }

      setUploads(allDocs)
      setLoadingDocs(false)
    }
    loadDocs()
  }, [familyUuid, members])

  const holder = holderOptions[selectedHolder] || holderOptions[0]

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedType || !holder) return

    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('document_type', selectedType)

      const response = await fetch(
        `${UPLOAD_API}/${holder.ownerType}/${holder.ownerId}/documents`,
        { method: 'POST', body: formData }
      )
      const result = await response.json()

      if (result.success && result.data) {
        setUploads(prev => [...prev, {
          document_id: result.data.document_id,
          document_type: result.data.document_type || selectedType,
          file_name: result.data.file_name || file.name,
          file_url: result.data.file_url,
          mime_type: result.data.mime_type,
          owner_type: holder.ownerType.toUpperCase(),
          owner_id: holder.ownerId,
        }])
      } else {
        setUploadError(result.error || 'Upload failed')
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (doc: UploadedDoc) => {
    try {
      const ot = doc.owner_type.toLowerCase()
      await fetch(`${UPLOAD_API}/${ot}/${doc.owner_id}/documents/${doc.document_id}`, { method: 'DELETE' })
      setUploads(prev => prev.filter(d => d.document_id !== doc.document_id))
    } catch {
      // ignore
    }
  }

  const getTypeLabel = (val: string) => ALL_DOC_TYPES.find(d => d.value === val)?.label || val

  const getHolderLabel = (doc: UploadedDoc) => {
    if (doc.owner_type === 'FAMILY') return `Family — ${familyId}`
    const m = members.find(mm => (mm.uuid || mm.member_id) === doc.owner_id)
    if (m) {
      const headTag = m.relationship_to_head === 'head' ? ' (Head)' : ''
      return `${m.first_name} ${m.last_name}${headTag}`
    }
    return 'Member'
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Step 3: Document Uploads
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Upload documents for the family or any member (optional)
        </p>
      </div>

      {/* Upload controls */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Document Holder
            </label>
            <select
              value={selectedHolder}
              onChange={(e) => setSelectedHolder(Number(e.target.value))}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
            >
              {holderOptions.map((opt, i) => (
                <option key={i} value={i}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Document Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
            >
              {ALL_DOC_TYPES.map(dt => (
                <option key={dt.value} value={dt.value}>{dt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Choose File
          </label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx"
            onChange={handleFileSelect}
            disabled={uploading}
            className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:font-medium file:cursor-pointer hover:file:bg-primary/90 disabled:opacity-50"
          />
        </div>

        {uploading && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
            Uploading…
          </div>
        )}

        {uploadError && (
          <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
            {uploadError}
          </div>
        )}
      </div>

      {/* Uploaded documents list */}
      {loadingDocs ? (
        <div className="flex items-center justify-center py-6">
          <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
        </div>
      ) : uploads.length > 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <h4 className="font-medium mb-3 text-gray-900 dark:text-white">
            Uploaded Documents ({uploads.length})
          </h4>
          <ul className="space-y-2">
            {uploads.map((doc) => (
              <li key={doc.document_id} className="flex items-center justify-between text-sm bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-base text-green-600 shrink-0">check_circle</span>
                  <div className="min-w-0">
                    <span className="font-medium block truncate">{getTypeLabel(doc.document_type)}</span>
                    <span className="text-gray-500 text-xs block truncate">
                      {getHolderLabel(doc)} — {doc.file_name}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(doc)}
                  className="text-red-500 hover:text-red-700 text-xs font-medium shrink-0 ml-2"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500">
          <span className="material-symbols-outlined text-4xl mb-2">description</span>
          <p>No documents uploaded yet. You can skip this step.</p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-lg font-medium"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isLoading}
          className="flex-1 py-3 px-4 bg-primary text-white rounded-lg font-medium"
        >
          Continue to Review
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4: REVIEW & SUBMIT
// ═══════════════════════════════════════════════════════════════════════════

function Step4Review({ 
  familyUuid,
  onSubmit,
  onSaveDraft,
  onBack,
  isLoading, 
  error 
}: { 
  familyUuid: string
  onSubmit: () => void
  onSaveDraft: () => void
  onBack: () => void
  isLoading: boolean
  error: string | null
}) {
  const [reviewData, setReviewData] = useState<{
    family: FamilyData | null
    permanent_address: AddressData | null
    members: MemberData[]
    validation: { is_valid: boolean; errors: string[] }
  } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const loadReview = async () => {
      try {
        const response = await fetch(`${API_BASE}/family/${familyUuid}/review`)
        const result = await response.json()
        
        if (result.success) {
          setReviewData({
            family: result.data?.family || null,
            permanent_address: result.data?.permanent_address || null,
            members: result.data?.members || [],
            validation: result.validation || { is_valid: false, errors: ['Unknown error'] },
          })
        } else {
          setLoadError(result.error || 'Failed to load review data')
        }
      } catch (err) {
        console.error('Review load error:', err)
        setLoadError('Network error loading review data')
      }
    }
    loadReview()
  }, [familyUuid])

  if (loadError) {
    return (
      <div className="p-6 text-center">
        <span className="material-symbols-outlined text-4xl text-red-500 mb-2">error</span>
        <p className="text-red-600">{loadError}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-gray-200 rounded-lg"
        >
          Go Back
        </button>
      </div>
    )
  }

  if (!reviewData) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Step 4: Review & Submit
        </h2>
      </div>

      {!reviewData.validation.is_valid && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-bold text-red-800">Validation Errors:</h4>
          <ul className="list-disc list-inside mt-2 text-red-700">
            {reviewData.validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="font-bold text-lg mb-3">Family Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Family ID:</span>
            <span className="ml-2 font-mono">{reviewData.family?.family_id || familyUuid.slice(0, 8) + '...'}</span>
          </div>
          <div>
            <span className="text-gray-500">Household Size:</span>
            <span className="ml-2">{reviewData.family?.household_size}</span>
          </div>
          <div>
            <span className="text-gray-500">Status:</span>
            <span className="ml-2">{reviewData.family?.registration_status}</span>
          </div>
          <div>
            <span className="text-gray-500">Intake Channel:</span>
            <span className="ml-2">{reviewData.family?.intake_channel}</span>
          </div>
        </div>
      </div>

      {reviewData.permanent_address && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold text-lg mb-3">Permanent Address</h3>
          <p>{reviewData.permanent_address.line1}</p>
          {reviewData.permanent_address.line2 && <p>{reviewData.permanent_address.line2}</p>}
          <p>{reviewData.permanent_address.parish}, {reviewData.permanent_address.district}</p>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="font-bold text-lg mb-3">Family Members ({reviewData.members.length})</h3>
        <div className="space-y-2">
          {reviewData.members.map((member, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
              <div>
                <span className="font-medium">{member.first_name} {member.last_name}</span>
                <span className="ml-2 text-sm text-gray-500">({member.relationship_to_head})</span>
              </div>
              <span className="text-sm text-gray-500">{member.gender}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onBack}
          className="py-3 px-4 border border-gray-300 rounded-lg"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isLoading}
          className="flex-1 py-3 px-4 border border-primary text-primary rounded-lg"
        >
          Save Draft
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isLoading || !reviewData.validation.is_valid}
          className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg font-medium disabled:opacity-50"
        >
          {isLoading ? 'Submitting...' : 'Submit Registration'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN WIZARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function RegistrationWizard() {
  const navigate = useNavigate()
  
  const urlParams = new URLSearchParams(window.location.search)
  const editFamilyId = urlParams.get('family') || urlParams.get('edit')

  const [state, setState] = useState<WizardState>({
    currentStep: 1,
    familyUuid: null,
    familyId: null,
    family: null,
    address: null,
    members: [],
    currentMemberIndex: 0,
    isLoading: false,
    error: null,
  })
  
  const [isEditMode, setIsEditMode] = useState(false)
  const [editDataLoaded, setEditDataLoaded] = useState(false)

  // Load existing family data for edit mode
  useEffect(() => {
    const loadFamilyForEdit = async () => {
      if (!editFamilyId || editDataLoaded) return
      
      setState(prev => ({ ...prev, isLoading: true }))
      
      const result = await apiCall<{
        family: FamilyData
        address: AddressData | null
        members: MemberData[]
      }>(`/family/${editFamilyId}`)
      
      if (result.success && result.data) {
        const { family, address, members } = result.data
        
        let currentStep = 1
        if (family && address) {
          currentStep = 2 // Go to members
          if (members && members.length >= family.household_size) {
            currentStep = 3 // Go to docs
          }
        }
        
        setState({
          currentStep,
          familyUuid: family.uuid,
          familyId: family.family_id,
          family,
          address,
          members: members || [],
          currentMemberIndex: 0,
          isLoading: false,
          error: null,
        })
        
        setIsEditMode(true)
        setEditDataLoaded(true)
      } else {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: result.error || 'Failed to load family data' 
        }))
        setEditDataLoaded(true)
      }
    }
    
    loadFamilyForEdit()
  }, [editFamilyId, editDataLoaded])

  const setLoading = (isLoading: boolean) => setState(prev => ({ ...prev, isLoading }))
  const setError = (error: string | null) => setState(prev => ({ ...prev, error }))
  const goToStep = (step: number) => setState(prev => ({ ...prev, currentStep: step, error: null }))

  // Step 1: Create Family with Address
  const handleCreateFamily = useCallback(async (data: {
    household_size: number
    intake_channel: string
    head_first_name: string
    head_last_name: string
    phone?: string
    email?: string
    geo_code?: string
    vulnerability_flag: boolean
    address: AddressData
  }) => {
    setLoading(true)
    setError(null)

    const familyResult = await apiCall<FamilyData>('/family', 'POST', {
      household_size: data.household_size,
      intake_channel: data.intake_channel,
      head_first_name: data.head_first_name,
      head_last_name: data.head_last_name,
      phone: data.phone || null,
      email: data.email || null,
      geo_code: data.geo_code || null,
      vulnerability_flag: data.vulnerability_flag || false,
    })

    if (!familyResult.success || !familyResult.data) {
      setError(familyResult.error || 'Failed to create family')
      setLoading(false)
      return
    }

    const familyUuid = familyResult.data.uuid
    const familyId = familyResult.data.family_id

    const addressResult = await apiCall<AddressData>(`/family/${familyUuid}/address`, 'POST', {
      line1: data.address.line1,
      line2: data.address.line2,
      parish: data.address.parish,
      district: data.address.district,
      geo_code: data.address.geo_code,
    })

    if (!addressResult.success) {
      setError(addressResult.error || 'Failed to create address')
      setLoading(false)
      return
    }

    setState(prev => ({
      ...prev,
      familyUuid,
      familyId,
      family: familyResult.data!,
      address: addressResult.data!,
      currentStep: 2, // Go to Members (was Family Docs before)
      isLoading: false,
    }))
  }, [])

  // Step 2: Member Added → loop or advance to Step 3 (Docs)
  const handleMemberAdded = useCallback((member: MemberData) => {
    setState(prev => {
      const newMembers = [...prev.members, member]
      const allAdded = newMembers.length >= (prev.family?.household_size || 1)
      return {
        ...prev,
        members: newMembers,
        currentStep: allAdded ? 3 : 2, // Go to docs step when all added
        error: null,
      }
    })
  }, [])

  // Step 4: Submit
  const handleSubmit = useCallback(async () => {
    if (!state.familyUuid) return
    setLoading(true)
    setError(null)

    const result = await apiCall<FamilyData>(`/family/${state.familyUuid}/submit`, 'POST')

    if (result.success && result.data) {
      navigate('/', { 
        replace: true,
        state: { 
          registrationSuccess: true,
          familyId: state.familyId,
          message: 'Registration submitted successfully! Your application is now pending verification.'
        }
      })
    } else {
      setError(result.error || 'Failed to submit')
      setLoading(false)
    }
  }, [state.familyUuid, state.familyId, navigate])

  const handleSaveDraft = useCallback(async () => {
    if (!state.familyUuid) return
    await apiCall(`/family/${state.familyUuid}/save-draft`, 'POST')
    navigate('/login')
  }, [state.familyUuid, navigate])

  // Step indicators
  const steps = [
    { num: 1, name: 'Family & Address' },
    { num: 2, name: 'Members' },
    { num: 3, name: 'Documents' },
    { num: 4, name: 'Review' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">
            {isEditMode ? 'Edit Family Registration' : 'Family Registration'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Social Protection Information System
          </p>
        </div>

        {editFamilyId && !editDataLoaded && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-4">progress_activity</span>
            <p className="text-gray-600">Loading family data...</p>
          </div>
        )}

        {state.error && !state.familyUuid && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center mb-6">
            <span className="material-symbols-outlined text-3xl text-red-500 mb-2">error</span>
            <p className="text-red-700">{state.error}</p>
            <button
              onClick={() => navigate('/family')}
              className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg"
            >
              Back to My Family
            </button>
          </div>
        )}

        {(!editFamilyId || editDataLoaded) && (
          <>
            {/* Step Indicator */}
            <div className="mb-8 overflow-x-auto">
              <div className="flex justify-center gap-1 min-w-max px-4">
                {steps.map((step) => (
                  <div key={step.num} className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        state.currentStep === step.num
                          ? 'bg-primary text-white'
                          : state.currentStep > step.num
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                      }`}
                    >
                      {state.currentStep > step.num ? '✓' : step.num}
                    </div>
                    <span className="text-xs mt-1 text-gray-500 whitespace-nowrap">{step.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step Content */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              {state.currentStep === 1 && (
                <Step1FamilyAndAddress
                  onNext={handleCreateFamily}
                  isLoading={state.isLoading}
                  error={state.error}
                />
              )}

              {state.currentStep === 2 && state.familyUuid && state.family && (
                <Step2Members
                  familyUuid={state.familyUuid}
                  householdSize={state.family.household_size}
                  membersAdded={state.members.length}
                  onMemberAdded={handleMemberAdded}
                  onNext={() => goToStep(3)}
                  onBack={() => goToStep(1)}
                  isLoading={state.isLoading}
                  error={state.error}
                />
              )}

              {state.currentStep === 3 && state.familyUuid && state.family && (
                <Step3Documents
                  familyUuid={state.familyUuid}
                  familyId={state.familyId || state.family.family_id}
                  members={state.members}
                  onNext={() => goToStep(4)}
                  onBack={() => goToStep(2)}
                  isLoading={state.isLoading}
                  error={state.error}
                />
              )}

              {state.currentStep === 4 && state.familyUuid && (
                <Step4Review
                  familyUuid={state.familyUuid}
                  onSubmit={handleSubmit}
                  onSaveDraft={handleSaveDraft}
                  onBack={() => goToStep(3)}
                  isLoading={state.isLoading}
                  error={state.error}
                />
              )}

              {state.currentStep === 4 && !state.familyUuid && (
                <div className="p-6 text-center bg-yellow-50 rounded-lg">
                  <p className="text-yellow-700">Debug: Step 4 reached but familyUuid is missing.</p>
                  <p className="text-sm text-gray-600 mt-2">Current state: {JSON.stringify({ currentStep: state.currentStep, familyUuid: state.familyUuid, familyId: state.familyId })}</p>
                  <button
                    onClick={() => goToStep(3)}
                    className="mt-4 px-4 py-2 bg-gray-200 rounded-lg"
                  >
                    Go Back
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 text-center text-sm text-gray-500">
              <p>All data is saved to the database in real-time.</p>
              <p>Your progress is preserved even if you leave this page.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
