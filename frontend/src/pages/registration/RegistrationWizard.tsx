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
  phone?: string | null
  email?: string | null
  // Migration 010 fields
  programme?: string | null
  payment_option?: string | null
  social_worker_zone?: string | null
  social_worker_code?: string | null
  application_no?: string | null
  constituency_code?: string | null
  head_middle_names?: string | null
  head_alias?: string | null
  head_mothers_maiden_name?: string | null
  mailing_address_different?: boolean
  directions_to_house?: string | null
}

interface AddressData {
  address_id?: string
  line1: string
  line2?: string
  parish: string
  district: string
  geo_code?: string
  // Migration 010 fields
  lot_apt?: string
  street_district?: string
  post_office?: string
  post_code?: string
  area_type?: string
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
  // Migration 010 fields
  middle_names?: string
  alias?: string
  trn?: string
  nis_no?: string
  id_type?: string
  id_number?: string
  birth_entry_number?: string
  mothers_maiden_name?: string
  is_twin?: boolean
  order_number?: number
  occupation?: string
  contact_no_1?: string
  contact_no_2?: string
  union_status?: string
  last_school_completed?: string
  school_name?: string
  school_parish?: string
  school_attended_since?: string
  pregnant?: string
  pregnancy_due_date?: string
  health_condition_disability?: boolean
  health_visual_impairment?: boolean
  health_hiv_aids?: boolean
  health_other?: boolean
  health_other_specify?: string
  pension_number?: string
  clinic_name?: string
  clinic_parish?: string
  clinic_number?: string
  reg_doc_birth_certificate?: boolean
  reg_doc_id?: boolean
  reg_doc_other?: boolean
  reg_doc_other_specify?: string
  sex_code?: string
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
  headData: { first_name: string; last_name: string; national_id: string; phone?: string; email?: string } | null
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
  onBack,
  initialData,
  isLoading, 
  error 
}: { 
  onNext: (data: { 
    household_size: number
    intake_channel: string
    head_first_name: string
    head_last_name: string
    head_national_id: string
    phone?: string
    email?: string
    geo_code?: string
    vulnerability_flag: boolean
    address: AddressData
    // Migration 010 fields
    programme?: string
    payment_option?: string
    social_worker_zone?: string
    social_worker_code?: string
    head_middle_names?: string
    head_alias?: string
    head_mothers_maiden_name?: string
    mailing_address_different?: boolean
    directions_to_house?: string
    mailing_address?: AddressData
  }) => void
  onBack: () => void
  initialData?: { family: FamilyData; address: AddressData | null }
  isLoading: boolean
  error: string | null
}) {
  const f = initialData?.family ?? null
  const a = initialData?.address ?? null
  const [formData, setFormData] = useState({
    household_size: f?.household_size ?? 1,
    intake_channel: f?.intake_channel ?? 'web_portal',
    head_first_name: f?.head_first_name ?? '',
    head_last_name: f?.head_last_name ?? '',
    head_national_id: '',
    phone: f?.phone ?? '',
    email: f?.email ?? '',
    geo_code: f?.geo_code ?? '',
    vulnerability_flag: f?.vulnerability_flag ?? false,
    // Migration 010 fields
    programme: f?.programme ?? '',
    payment_option: f?.payment_option ?? '',
    social_worker_zone: f?.social_worker_zone ?? '',
    social_worker_code: f?.social_worker_code ?? '',
    head_middle_names: f?.head_middle_names ?? '',
    head_alias: f?.head_alias ?? '',
    head_mothers_maiden_name: f?.head_mothers_maiden_name ?? '',
    mailing_address_different: f?.mailing_address_different ?? false,
    directions_to_house: f?.directions_to_house ?? '',
    address: {
      line1: a?.line1 ?? '',
      line2: a?.line2 ?? '',
      parish: a?.parish ?? '',
      district: a?.district ?? '',
      geo_code: a?.geo_code ?? '',
      lot_apt: a?.lot_apt ?? '',
      street_district: a?.street_district ?? '',
      post_office: a?.post_office ?? '',
      post_code: a?.post_code ?? '',
      area_type: a?.area_type ?? '',
    } as AddressData,
    mailing_address: {
      line1: '',
      line2: '',
      parish: '',
      district: '',
      geo_code: '',
      lot_apt: '',
      street_district: '',
      post_office: '',
      post_code: '',
      area_type: '',
    } as AddressData,
  })

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [checkingNid, setCheckingNid] = useState(false)

  const validateEmail = (email: string): boolean => {
    if (!email) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const errors: Record<string, string> = {}
    
    if (!formData.head_first_name.trim()) {
      errors.head_first_name = 'First name is required'
    }
    if (!formData.head_last_name.trim()) {
      errors.head_last_name = 'Last name is required'
    }
    // National ID validation
    const cleanNid = formData.head_national_id.replace(/\D/g, '')
    if (!cleanNid) {
      errors.head_national_id = 'National ID is required for the head of household'
    } else if (cleanNid.length !== 14) {
      errors.head_national_id = 'National ID must be exactly 14 digits'
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

    // Check national_id uniqueness via API
    setCheckingNid(true)
    try {
      const checkRes = await fetch(`http://localhost:3001/api/v1/registration/check-national-id/${cleanNid}`)
      if (!checkRes.ok) {
        throw new Error(`HTTP ${checkRes.status}: Failed to verify National ID`)
      }
      const checkData = await checkRes.json()
      if (checkData.exists) {
        setValidationErrors({ head_national_id: 'A family already exists with a member using this National ID. Registration is not allowed.' })
        setCheckingNid(false)
        return
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unable to verify National ID. Please try again.'
      setValidationErrors({ head_national_id: errorMsg })
      setCheckingNid(false)
      return
    }
    setCheckingNid(false)

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
              <label htmlFor="head_middle_names" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Middle Name(s)
              </label>
              <input
                id="head_middle_names"
                type="text"
                value={formData.head_middle_names}
                onChange={(e) => setFormData(prev => ({ ...prev, head_middle_names: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              />
            </div>
            <div>
              <label htmlFor="head_alias" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Alias / Also Known As
              </label>
              <input
                id="head_alias"
                type="text"
                value={formData.head_alias}
                onChange={(e) => setFormData(prev => ({ ...prev, head_alias: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="head_mothers_maiden_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mother&apos;s Maiden Name
            </label>
            <input
              id="head_mothers_maiden_name"
              type="text"
              value={formData.head_mothers_maiden_name}
              onChange={(e) => setFormData(prev => ({ ...prev, head_mothers_maiden_name: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
            />
          </div>

          <div>
            <label htmlFor="head_national_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Head&apos;s National ID (14 digits) *
            </label>
            <input
              id="head_national_id"
              type="text"
              inputMode="numeric"
              value={formData.head_national_id}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 14)
                setFormData(prev => ({ ...prev, head_national_id: digits }))
                if (validationErrors.head_national_id) {
                  setValidationErrors(prev => { const n = { ...prev }; delete n.head_national_id; return n })
                }
              }}
              placeholder="Enter 14-digit National ID"
              maxLength={14}
              className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 ${validationErrors.head_national_id ? 'border-red-500' : ''}`}
              required
            />
            {validationErrors.head_national_id && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.head_national_id}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Required — ensures no duplicate registrations</p>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="programme" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Programme Applied For
              </label>
              <select
                id="programme"
                value={formData.programme}
                onChange={(e) => setFormData(prev => ({ ...prev, programme: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              >
                <option value="">Select Programme...</option>
                <option value="PATH">PATH</option>
                <option value="STEP">STEP</option>
                <option value="SSP">SSP</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="payment_option" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payment Option
              </label>
              <select
                id="payment_option"
                value={formData.payment_option}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_option: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              >
                <option value="">Select...</option>
                <option value="DIRECT_DEPOSIT">Direct Deposit</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="social_worker_zone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Social Worker Zone
              </label>
              <input
                id="social_worker_zone"
                type="text"
                value={formData.social_worker_zone}
                onChange={(e) => setFormData(prev => ({ ...prev, social_worker_zone: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              />
            </div>
            <div>
              <label htmlFor="social_worker_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Social Worker Code
              </label>
              <input
                id="social_worker_code"
                type="text"
                value={formData.social_worker_code}
                onChange={(e) => setFormData(prev => ({ ...prev, social_worker_code: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              />
            </div>
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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="lot_apt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Lot/Apt No.
              </label>
              <input
                id="lot_apt"
                type="text"
                value={formData.address.lot_apt || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, address: { ...prev.address, lot_apt: e.target.value } }))}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              />
            </div>
            <div>
              <label htmlFor="street_district" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Street/District
              </label>
              <input
                id="street_district"
                type="text"
                value={formData.address.street_district || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, address: { ...prev.address, street_district: e.target.value } }))}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              />
            </div>
            <div>
              <label htmlFor="post_office" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Post Office
              </label>
              <input
                id="post_office"
                type="text"
                value={formData.address.post_office || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, address: { ...prev.address, post_office: e.target.value } }))}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="post_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Post Code
              </label>
              <input
                id="post_code"
                type="text"
                value={formData.address.post_code || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, address: { ...prev.address, post_code: e.target.value } }))}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              />
            </div>
            <div>
              <label htmlFor="area_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Area Type
              </label>
              <select
                id="area_type"
                value={formData.address.area_type || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, address: { ...prev.address, area_type: e.target.value } }))}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              >
                <option value="">Select...</option>
                <option value="URBAN">Urban</option>
                <option value="PERI_URBAN">Peri-Urban</option>
                <option value="RURAL">Rural</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="directions_to_house" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Directions to House
            </label>
            <textarea
              id="directions_to_house"
              value={formData.directions_to_house}
              onChange={(e) => setFormData(prev => ({ ...prev, directions_to_house: e.target.value }))}
              rows={2}
              placeholder="Landmarks or directions to locate the house"
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
            />
          </div>
        </div>

        {/* MAILING ADDRESS SECTION */}
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg space-y-4">
          <h3 className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <span className="material-symbols-outlined">mail</span>
            Mailing Address
          </h3>

          <div className="flex items-center gap-3">
            <input
              id="mailing_address_different"
              type="checkbox"
              checked={formData.mailing_address_different}
              onChange={(e) => setFormData(prev => ({ ...prev, mailing_address_different: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300"
            />
            <label htmlFor="mailing_address_different" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Mailing address is different from permanent address
            </label>
          </div>

          {formData.mailing_address_different && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={formData.mailing_address.line1}
                    onChange={(e) => setFormData(prev => ({ ...prev, mailing_address: { ...prev.mailing_address, line1: e.target.value } }))}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={formData.mailing_address.line2 || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, mailing_address: { ...prev.mailing_address, line2: e.target.value } }))}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parish</label>
                  <input
                    type="text"
                    value={formData.mailing_address.parish}
                    onChange={(e) => setFormData(prev => ({ ...prev, mailing_address: { ...prev.mailing_address, parish: e.target.value } }))}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">District</label>
                  <input
                    type="text"
                    value={formData.mailing_address.district}
                    onChange={(e) => setFormData(prev => ({ ...prev, mailing_address: { ...prev.mailing_address, district: e.target.value } }))}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Post Office</label>
                  <input
                    type="text"
                    value={formData.mailing_address.post_office || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, mailing_address: { ...prev.mailing_address, post_office: e.target.value } }))}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Post Code</label>
                  <input
                    type="text"
                    value={formData.mailing_address.post_code || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, mailing_address: { ...prev.mailing_address, post_code: e.target.value } }))}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
              </div>
            </div>
          )}
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
            className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-lg font-medium flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>{' '}
            Back
          </button>
          <button
            type="submit"
            disabled={isLoading || checkingNid}
            className="flex-1 py-3 px-4 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading || checkingNid ? (
              <>
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                {checkingNid ? 'Verifying National ID...' : 'Creating Family...'}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">arrow_forward</span>{' '}
                Create Family & Continue
              </>
            )}
          </button>
        </div>
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
  savedCount,
  currentIndex,
  editingMember,
  headData,
  onMemberSaved,
  onNext, 
  onBack,
  isLoading, 
  error 
}: { 
  familyUuid: string
  householdSize: number
  savedCount: number
  currentIndex: number
  editingMember: MemberData | null
  headData: { first_name: string; last_name: string; national_id: string; phone?: string; email?: string } | null
  onMemberSaved: (member: MemberData, wasUpdate: boolean) => void
  onNext: () => void
  onBack: () => void
  isLoading: boolean
  error: string | null
}) {
  const isFirstMember = currentIndex === 0
  const isEditing = editingMember != null
  const [formData, setFormData] = useState<MemberData>(() => {
    // Pre-populate when editing an existing member (navigated back)
    if (editingMember) return { ...editingMember }
    // Fresh form for first member — seed name/id from family head data
    return {
    first_name: isFirstMember && headData ? headData.first_name : '',
    last_name: isFirstMember && headData ? headData.last_name : '',
    national_id: isFirstMember && headData ? headData.national_id : '',
    date_of_birth: '',
    gender: undefined,
    relationship_to_head: isFirstMember ? 'head' : '',
    marital_status: '',
    alive_flag: true,
    use_family_address: false,
    phone: isFirstMember && headData?.phone ? headData.phone : '',
    email: isFirstMember && headData?.email ? headData.email : '',
    current_address: {
      line1: '',
      line2: '',
      parish: '',
      district: '',
    },
    // Migration 010 fields
    middle_names: '',
    alias: '',
    trn: '',
    nis_no: '',
    id_type: '',
    id_number: '',
    birth_entry_number: '',
    mothers_maiden_name: '',
    is_twin: false,
    order_number: undefined,
    occupation: '',
    contact_no_1: '',
    contact_no_2: '',
    union_status: '',
    last_school_completed: '',
    school_name: '',
    school_parish: '',
    school_attended_since: '',
    pregnant: '',
    pregnancy_due_date: '',
    health_condition_disability: false,
    health_visual_impairment: false,
    health_hiv_aids: false,
    health_other: false,
    health_other_specify: '',
    pension_number: '',
    clinic_name: '',
    clinic_parish: '',
    clinic_number: '',
    reg_doc_birth_certificate: false,
    reg_doc_id: false,
    reg_doc_other: false,
    reg_doc_other_specify: '',
    sex_code: '',
  }})

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [showExtended, setShowExtended] = useState(false)
  const remaining = householdSize - savedCount

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
      // Migration 010 extended fields
      middle_names: formData.middle_names || null,
      alias: formData.alias || null,
      trn: formData.trn || null,
      nis_no: formData.nis_no || null,
      id_type: formData.id_type || null,
      id_number: formData.id_number || null,
      birth_entry_number: formData.birth_entry_number || null,
      mothers_maiden_name: formData.mothers_maiden_name || null,
      is_twin: formData.is_twin || false,
      order_number: formData.order_number || null,
      occupation: formData.occupation || null,
      contact_no_1: formData.contact_no_1 || null,
      contact_no_2: formData.contact_no_2 || null,
      union_status: formData.union_status || null,
      last_school_completed: formData.last_school_completed || null,
      school_name: formData.school_name || null,
      school_parish: formData.school_parish || null,
      school_attended_since: formData.school_attended_since || null,
      pregnant: formData.pregnant || null,
      pregnancy_due_date: formData.pregnancy_due_date || null,
      health_condition_disability: formData.health_condition_disability || false,
      health_visual_impairment: formData.health_visual_impairment || false,
      health_hiv_aids: formData.health_hiv_aids || false,
      health_other: formData.health_other || false,
      health_other_specify: formData.health_other_specify || null,
      pension_number: formData.pension_number || null,
      clinic_name: formData.clinic_name || null,
      clinic_parish: formData.clinic_parish || null,
      clinic_number: formData.clinic_number || null,
      reg_doc_birth_certificate: formData.reg_doc_birth_certificate || false,
      reg_doc_id: formData.reg_doc_id || false,
      reg_doc_other: formData.reg_doc_other || false,
      reg_doc_other_specify: formData.reg_doc_other_specify || null,
      sex_code: formData.sex_code || null,
    }
    
    const result = isEditing && editingMember?.uuid
      ? await apiCall(`/family/${familyUuid}/members/${editingMember.uuid}`, 'PUT', memberPayload)
      : await apiCall<{ uuid: string; member_id: string }>(`/family/${familyUuid}/members`, 'POST', memberPayload)

    if (result.success && result.data) {
      const memberResult = result.data as { uuid: string; member_id: string }
      const memberData: MemberData = {
        ...formData,
        member_id: memberResult.member_id ?? editingMember?.member_id,
        uuid: memberResult.uuid ?? editingMember?.uuid,
      }
      onMemberSaved(memberData, isEditing)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Step 2: Family Members
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {isEditing ? `Editing member ${currentIndex + 1} of ${householdSize}` : `Adding member ${currentIndex + 1} of ${householdSize}`}
        </p>
        <div className="flex items-center justify-center gap-2 mt-3">
          {Array.from({ length: householdSize }).map((_, i) => (
            <div
              key={i}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i < savedCount && i !== currentIndex
                  ? 'bg-green-500 text-white'
                  : i === currentIndex
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }`}
            >
              {i < savedCount && i !== currentIndex ? '✓' : i + 1}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isFirstMember && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-2">
            <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">info</span>
              Head of Household details are pre-filled from family registration and cannot be changed.
            </p>
          </div>
        )}

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
              className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 ${isFirstMember ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
              required
              readOnly={isFirstMember}
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
              className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 ${isFirstMember ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
              required
              readOnly={isFirstMember}
            />
          </div>
        </div>

        <div>
          <label htmlFor="national_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            National ID (14 digits){isFirstMember ? ' *' : ''}
          </label>
          <input
            id="national_id"
            type="text"
            inputMode="numeric"
            value={formData.national_id || ''}
            onChange={(e) => {
              if (isFirstMember) return
              const digits = e.target.value.replace(/\D/g, '').slice(0, 14)
              setFormData(prev => ({ ...prev, national_id: digits }))
            }}
            placeholder="Enter 14-digit National ID"
            maxLength={14}
            className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 ${validationErrors.national_id ? 'border-red-500' : ''} ${isFirstMember ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
            readOnly={isFirstMember}
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
                if (isFirstMember && headData?.phone) return
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                setFormData(prev => ({ ...prev, phone: digits }))
              }}
              placeholder="10-digit phone number"
              maxLength={10}
              className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 ${isFirstMember && headData?.phone ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
              readOnly={isFirstMember && !!headData?.phone}
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
              onChange={(e) => {
                if (isFirstMember && headData?.email) return
                setFormData(prev => ({ ...prev, email: e.target.value }))
              }}
              placeholder="name@example.com"
              className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 ${validationErrors.email ? 'border-red-500' : ''} ${isFirstMember && headData?.email ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
              readOnly={isFirstMember && !!headData?.email}
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
              onChange={(e) => {
                if (isFirstMember) return
                setFormData(prev => ({ ...prev, relationship_to_head: e.target.value }))
              }}
              className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 ${isFirstMember ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
              required
              disabled={isFirstMember}
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

        {/* EXTENDED MEMBER FIELDS (Collapsible) */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
          <button
            type="button"
            onClick={() => setShowExtended(!showExtended)}
            className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">tune</span>
              Additional Details
            </span>
            <span className="material-symbols-outlined text-base">
              {showExtended ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {showExtended && (
            <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
              {/* Identity Section */}
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg space-y-3">
                <h4 className="text-sm font-bold text-indigo-800 dark:text-indigo-300">Identity</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Middle Name(s)</label>
                    <input type="text" value={formData.middle_names || ''} onChange={(e) => setFormData(prev => ({ ...prev, middle_names: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Alias</label>
                    <input type="text" value={formData.alias || ''} onChange={(e) => setFormData(prev => ({ ...prev, alias: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">TRN</label>
                    <input type="text" value={formData.trn || ''} onChange={(e) => setFormData(prev => ({ ...prev, trn: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" placeholder="Tax Registration Number" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">NIS No.</label>
                    <input type="text" value={formData.nis_no || ''} onChange={(e) => setFormData(prev => ({ ...prev, nis_no: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">ID Type</label>
                    <select value={formData.id_type || ''} onChange={(e) => setFormData(prev => ({ ...prev, id_type: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600">
                      <option value="">Select...</option>
                      <option value="NATIONAL_ID">National ID</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="DRIVERS_LICENSE">Driver&apos;s License</option>
                      <option value="VOTERS_ID">Voter&apos;s ID</option>
                      <option value="BIRTH_CERTIFICATE">Birth Certificate</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">ID Number</label>
                    <input type="text" value={formData.id_number || ''} onChange={(e) => setFormData(prev => ({ ...prev, id_number: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Birth Entry Number</label>
                    <input type="text" value={formData.birth_entry_number || ''} onChange={(e) => setFormData(prev => ({ ...prev, birth_entry_number: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Mother&apos;s Maiden Name</label>
                    <input type="text" value={formData.mothers_maiden_name || ''} onChange={(e) => setFormData(prev => ({ ...prev, mothers_maiden_name: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.is_twin || false} onChange={(e) => setFormData(prev => ({ ...prev, is_twin: e.target.checked }))} className="w-4 h-4 rounded" />
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Twin</label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Order No.</label>
                    <input type="number" min="1" value={formData.order_number || ''} onChange={(e) => setFormData(prev => ({ ...prev, order_number: e.target.value ? Number(e.target.value) : undefined }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sex Code</label>
                    <input type="text" value={formData.sex_code || ''} onChange={(e) => setFormData(prev => ({ ...prev, sex_code: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" maxLength={1} />
                  </div>
                </div>
              </div>

              {/* Employment & Contact */}
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg space-y-3">
                <h4 className="text-sm font-bold text-green-800 dark:text-green-300">Employment & Contact</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Occupation</label>
                    <input type="text" value={formData.occupation || ''} onChange={(e) => setFormData(prev => ({ ...prev, occupation: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Union Status</label>
                    <select value={formData.union_status || ''} onChange={(e) => setFormData(prev => ({ ...prev, union_status: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600">
                      <option value="">Select...</option>
                      <option value="MARRIED">Married</option>
                      <option value="COMMON_LAW">Common Law</option>
                      <option value="VISITING">Visiting</option>
                      <option value="SINGLE">Single</option>
                      <option value="DIVORCED">Divorced</option>
                      <option value="WIDOWED">Widowed</option>
                      <option value="SEPARATED">Separated</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Contact No. 1</label>
                    <input type="tel" value={formData.contact_no_1 || ''} onChange={(e) => setFormData(prev => ({ ...prev, contact_no_1: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Contact No. 2</label>
                    <input type="tel" value={formData.contact_no_2 || ''} onChange={(e) => setFormData(prev => ({ ...prev, contact_no_2: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                </div>
              </div>

              {/* Education */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg space-y-3">
                <h4 className="text-sm font-bold text-yellow-800 dark:text-yellow-300">Education</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Last School Completed</label>
                  <select value={formData.last_school_completed || ''} onChange={(e) => setFormData(prev => ({ ...prev, last_school_completed: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600">
                    <option value="">Select...</option>
                    <option value="NONE">None</option>
                    <option value="PRIMARY">Primary</option>
                    <option value="SECONDARY">Secondary</option>
                    <option value="TERTIARY">Tertiary</option>
                    <option value="VOCATIONAL">Vocational</option>
                    <option value="UNIVERSITY">University</option>
                    <option value="POST_GRADUATE">Post Graduate</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">School Name</label>
                    <input type="text" value={formData.school_name || ''} onChange={(e) => setFormData(prev => ({ ...prev, school_name: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">School Parish</label>
                    <input type="text" value={formData.school_parish || ''} onChange={(e) => setFormData(prev => ({ ...prev, school_parish: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Attended Since</label>
                    <input type="date" value={formData.school_attended_since || ''} onChange={(e) => setFormData(prev => ({ ...prev, school_attended_since: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                </div>
              </div>

              {/* Health */}
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg space-y-3">
                <h4 className="text-sm font-bold text-red-800 dark:text-red-300">Health</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Pregnant</label>
                    <select value={formData.pregnant || ''} onChange={(e) => setFormData(prev => ({ ...prev, pregnant: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600">
                      <option value="">N/A</option>
                      <option value="YES">Yes</option>
                      <option value="NO">No</option>
                      <option value="NOT_APPLICABLE">Not Applicable</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Pregnancy Due Date</label>
                    <input type="date" value={formData.pregnancy_due_date || ''} onChange={(e) => setFormData(prev => ({ ...prev, pregnancy_due_date: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" disabled={formData.pregnant !== 'YES'} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={formData.health_condition_disability || false} onChange={(e) => setFormData(prev => ({ ...prev, health_condition_disability: e.target.checked }))} className="w-4 h-4 rounded" /> Disability</label>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={formData.health_visual_impairment || false} onChange={(e) => setFormData(prev => ({ ...prev, health_visual_impairment: e.target.checked }))} className="w-4 h-4 rounded" /> Visual Impairment</label>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={formData.health_hiv_aids || false} onChange={(e) => setFormData(prev => ({ ...prev, health_hiv_aids: e.target.checked }))} className="w-4 h-4 rounded" /> HIV/AIDS</label>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={formData.health_other || false} onChange={(e) => setFormData(prev => ({ ...prev, health_other: e.target.checked }))} className="w-4 h-4 rounded" /> Other</label>
                </div>
                {formData.health_other && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Specify Other Health Condition</label>
                    <input type="text" value={formData.health_other_specify || ''} onChange={(e) => setFormData(prev => ({ ...prev, health_other_specify: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Pension Number</label>
                    <input type="text" value={formData.pension_number || ''} onChange={(e) => setFormData(prev => ({ ...prev, pension_number: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Clinic Name</label>
                    <input type="text" value={formData.clinic_name || ''} onChange={(e) => setFormData(prev => ({ ...prev, clinic_name: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Clinic Parish</label>
                    <input type="text" value={formData.clinic_parish || ''} onChange={(e) => setFormData(prev => ({ ...prev, clinic_parish: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Clinic Number</label>
                    <input type="text" value={formData.clinic_number || ''} onChange={(e) => setFormData(prev => ({ ...prev, clinic_number: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                </div>
              </div>

              {/* Registration Documents */}
              <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg space-y-3">
                <h4 className="text-sm font-bold text-purple-800 dark:text-purple-300">Registration Documents Presented</h4>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={formData.reg_doc_birth_certificate || false} onChange={(e) => setFormData(prev => ({ ...prev, reg_doc_birth_certificate: e.target.checked }))} className="w-4 h-4 rounded" /> Birth Certificate</label>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={formData.reg_doc_id || false} onChange={(e) => setFormData(prev => ({ ...prev, reg_doc_id: e.target.checked }))} className="w-4 h-4 rounded" /> ID</label>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={formData.reg_doc_other || false} onChange={(e) => setFormData(prev => ({ ...prev, reg_doc_other: e.target.checked }))} className="w-4 h-4 rounded" /> Other</label>
                </div>
                {formData.reg_doc_other && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Specify Other Document</label>
                    <input type="text" value={formData.reg_doc_other_specify || ''} onChange={(e) => setFormData(prev => ({ ...prev, reg_doc_other_specify: e.target.value }))} className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                )}
              </div>
            </div>
          )}
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

        {savedCount === householdSize && (
          <button
            type="button"
            onClick={onNext}
            className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-medium"
          >
            All Members Added — Continue to Documents
          </button>
        )}

        {savedCount > 0 && savedCount < householdSize && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
              <span className="material-symbols-outlined text-base">warning</span>
              {householdSize - savedCount} more member{householdSize - savedCount > 1 ? 's' : ''} still needed
            </p>
            <p className="text-amber-700 dark:text-amber-400 mt-1">
              You must add all {householdSize} members before you can submit. To reduce the count,{' '}
              <button type="button" onClick={onBack} className="underline font-semibold hover:text-amber-900">
                go back to Step 1
              </button>{' '}and change the household size.
            </p>
          </div>
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
    mailing_address: AddressData | null
    house_services: Record<string, unknown> | null
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
            mailing_address: result.data?.mailing_address || null,
            house_services: result.data?.house_services || null,
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
          {reviewData.family?.programme && (
            <div>
              <span className="text-gray-500">Programme:</span>
              <span className="ml-2">{reviewData.family.programme}</span>
            </div>
          )}
          {reviewData.family?.payment_option && (
            <div>
              <span className="text-gray-500">Payment Option:</span>
              <span className="ml-2">{reviewData.family.payment_option}</span>
            </div>
          )}
          {reviewData.family?.head_middle_names && (
            <div>
              <span className="text-gray-500">Head Middle Names:</span>
              <span className="ml-2">{reviewData.family.head_middle_names}</span>
            </div>
          )}
          {reviewData.family?.head_alias && (
            <div>
              <span className="text-gray-500">Head Alias:</span>
              <span className="ml-2">{reviewData.family.head_alias}</span>
            </div>
          )}
          {reviewData.family?.directions_to_house && (
            <div className="col-span-2">
              <span className="text-gray-500">Directions:</span>
              <span className="ml-2">{reviewData.family.directions_to_house}</span>
            </div>
          )}
        </div>
      </div>

      {reviewData.permanent_address && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold text-lg mb-3">Permanent Address</h3>
          <p>{reviewData.permanent_address.line1}</p>
          {reviewData.permanent_address.line2 && <p>{reviewData.permanent_address.line2}</p>}
          <p>{reviewData.permanent_address.parish}, {reviewData.permanent_address.district}</p>
          {(reviewData.permanent_address.lot_apt || reviewData.permanent_address.post_office || reviewData.permanent_address.area_type) && (
            <div className="mt-2 text-sm text-gray-500 grid grid-cols-3 gap-2">
              {reviewData.permanent_address.lot_apt && <span>Lot/Apt: {reviewData.permanent_address.lot_apt}</span>}
              {reviewData.permanent_address.post_office && <span>P.O.: {reviewData.permanent_address.post_office}</span>}
              {reviewData.permanent_address.area_type && <span>Area: {reviewData.permanent_address.area_type}</span>}
            </div>
          )}
        </div>
      )}

      {reviewData.mailing_address && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold text-lg mb-3">Mailing Address</h3>
          <p>{reviewData.mailing_address.line1}</p>
          {reviewData.mailing_address.line2 && <p>{reviewData.mailing_address.line2}</p>}
          <p>{reviewData.mailing_address.parish}, {reviewData.mailing_address.district}</p>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="font-bold text-lg mb-3">Family Members ({reviewData.members.length})</h3>
        <div className="space-y-2">
          {reviewData.members.map((member, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
              <div>
                <span className="font-medium">{member.first_name} {member.middle_names ? member.middle_names + ' ' : ''}{member.last_name}</span>
                <span className="ml-2 text-sm text-gray-500">({member.relationship_to_head})</span>
                {member.trn && <span className="ml-2 text-xs text-gray-400">TRN: {member.trn}</span>}
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
    headData: null,
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
          headData: null,
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
    head_national_id: string
    phone?: string
    email?: string
    geo_code?: string
    vulnerability_flag: boolean
    address: AddressData
    programme?: string
    payment_option?: string
    social_worker_zone?: string
    social_worker_code?: string
    head_middle_names?: string
    head_alias?: string
    head_mothers_maiden_name?: string
    mailing_address_different?: boolean
    directions_to_house?: string
    mailing_address?: AddressData
  }) => {
    setLoading(true)
    setError(null)

    // If family already exists (user went back from Step 2), UPDATE instead of create
    let existingUuid: string | null = null
    setState(prev => { existingUuid = prev.familyUuid; return prev })

    if (existingUuid) {
      const familyResult = await apiCall<FamilyData>(`/family/${existingUuid}`, 'PUT', {
        household_size: data.household_size,
        head_first_name: data.head_first_name,
        head_last_name: data.head_last_name,
        phone: data.phone || null,
        email: data.email || null,
        vulnerability_flag: data.vulnerability_flag || false,
        programme: data.programme || null,
        payment_option: data.payment_option || null,
        social_worker_zone: data.social_worker_zone || null,
        social_worker_code: data.social_worker_code || null,
        head_middle_names: data.head_middle_names || null,
        head_alias: data.head_alias || null,
        head_mothers_maiden_name: data.head_mothers_maiden_name || null,
        mailing_address_different: data.mailing_address_different || false,
        directions_to_house: data.directions_to_house || null,
      })
      if (!familyResult.success) {
        setError(familyResult.error || 'Failed to update family')
        setLoading(false)
        return
      }
      await apiCall<AddressData>(`/family/${existingUuid}/address`, 'PUT', {
        line1: data.address.line1,
        line2: data.address.line2,
        parish: data.address.parish,
        district: data.address.district,
        geo_code: data.address.geo_code,
        lot_apt: data.address.lot_apt || null,
        street_district: data.address.street_district || null,
        post_office: data.address.post_office || null,
        post_code: data.address.post_code || null,
        area_type: data.address.area_type || null,
      })
      setState(prev => ({
        ...prev,
        family: familyResult.data!,
        headData: {
          first_name: data.head_first_name,
          last_name: data.head_last_name,
          national_id: data.head_national_id,
          phone: data.phone,
          email: data.email,
        },
        currentStep: 2,
        isLoading: false,
      }))
      return
    }

    const familyResult = await apiCall<FamilyData>('/family', 'POST', {
      household_size: data.household_size,
      intake_channel: data.intake_channel,
      head_first_name: data.head_first_name,
      head_last_name: data.head_last_name,
      head_national_id: data.head_national_id,
      phone: data.phone || null,
      email: data.email || null,
      geo_code: data.geo_code || null,
      vulnerability_flag: data.vulnerability_flag || false,
      // Migration 010 fields
      programme: data.programme || null,
      payment_option: data.payment_option || null,
      social_worker_zone: data.social_worker_zone || null,
      social_worker_code: data.social_worker_code || null,
      head_middle_names: data.head_middle_names || null,
      head_alias: data.head_alias || null,
      head_mothers_maiden_name: data.head_mothers_maiden_name || null,
      mailing_address_different: data.mailing_address_different || false,
      directions_to_house: data.directions_to_house || null,
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
      lot_apt: data.address.lot_apt || null,
      street_district: data.address.street_district || null,
      post_office: data.address.post_office || null,
      post_code: data.address.post_code || null,
      area_type: data.address.area_type || null,
    })

    if (!addressResult.success) {
      setError(addressResult.error || 'Failed to create address')
      setLoading(false)
      return
    }

    // Create mailing address if different
    if (data.mailing_address_different && data.mailing_address) {
      await apiCall(`/family/${familyUuid}/mailing-address`, 'POST', {
        same_as_permanent: false,
        line1: data.mailing_address.line1,
        line2: data.mailing_address.line2,
        parish: data.mailing_address.parish,
        district: data.mailing_address.district,
        post_office: data.mailing_address.post_office || null,
        post_code: data.mailing_address.post_code || null,
      })
    }

    setState(prev => ({
      ...prev,
      familyUuid,
      familyId,
      family: familyResult.data!,
      address: addressResult.data!,
      headData: {
        first_name: data.head_first_name,
        last_name: data.head_last_name,
        national_id: data.head_national_id,
        phone: data.phone,
        email: data.email,
      },
      currentStep: 2, // Go to Members (was Family Docs before)
      isLoading: false,
    }))
  }, [])

  // Step 2: Member saved (new or updated) → loop or advance to Step 3
  const handleMemberSaved = useCallback((member: MemberData, wasUpdate: boolean) => {
    setState(prev => {
      const newMembers = [...prev.members]
      if (wasUpdate) {
        newMembers[prev.currentMemberIndex] = member
      } else {
        newMembers.push(member)
      }
      const nextIndex = prev.currentMemberIndex + 1
      const allAdded = nextIndex >= (prev.family?.household_size || 1)
      return {
        ...prev,
        members: newMembers,
        currentMemberIndex: nextIndex,
        currentStep: allAdded ? 3 : 2,
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
                  onBack={() => navigate(isEditMode ? '/family' : '/')}
                  initialData={state.family ? { family: state.family, address: state.address } : undefined}
                  isLoading={state.isLoading}
                  error={state.error}
                />
              )}

              {state.currentStep === 2 && state.familyUuid && state.family && (
                <Step2Members
                  key={state.currentMemberIndex}
                  familyUuid={state.familyUuid}
                  householdSize={state.family.household_size}
                  savedCount={state.members.length}
                  currentIndex={state.currentMemberIndex}
                  editingMember={state.members[state.currentMemberIndex] ?? null}
                  headData={state.headData}
                  onMemberSaved={handleMemberSaved}
                  onNext={() => goToStep(3)}
                  onBack={() => {
                    if (state.currentMemberIndex > 0) {
                      setState(prev => ({ ...prev, currentMemberIndex: prev.currentMemberIndex - 1 }))
                    } else {
                      goToStep(1)
                    }
                  }}
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
