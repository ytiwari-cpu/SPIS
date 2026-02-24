/**
 * CITIZEN PORTAL — DOCUMENTS PAGE
 *
 * Live API integration:
 * - Fetches family + members from /api/v1/families/:uuid
 * - Fetches documents from /api/v1/documents/family/:uuid & /api/v1/documents/member/:uuid
 * - Uploads via POST /api/v1/upload/:ownerType/:ownerId/documents (multer FormData)
 * - Removes via DELETE /api/v1/upload/:ownerType/:ownerId/documents/:documentId
 * - Holder dropdown (Family / Member1 / Member2…) + type dropdown
 * - Re-upload support for REJECTED documents
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authFetch, authUpload, API_BASE, extractApiError } from '@/services/authFetch'
import type { DocumentStatus } from '@/types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface MemberInfo {
  uuid: string
  first_name: string
  last_name: string
  relationship_to_head: string
}

interface DocRecord {
  document_id: string
  document_type: string
  file_name: string
  file_path?: string
  file_url?: string
  mime_type?: string
  owner_type: string   // 'FAMILY' | 'MEMBER'
  owner_id: string
  status: DocumentStatus
  rejection_reason?: string
  uploaded_at: string
  document_verification?: Array<{
    status: string
    rejection_reason?: string
    verified_at?: string
  }>
}

interface HolderOption {
  label: string
  ownerType: 'family' | 'member'
  ownerId: string
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const UPLOAD_API = `${API_BASE}/upload`

const DOC_TYPES = [
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

const documentTypeLabels: Record<string, string> = Object.fromEntries(
  DOC_TYPES.map(dt => [dt.value, dt.label])
)

// Also support the uppercase enum values coming from DB
const allTypeLabels: Record<string, string> = {
  ...documentTypeLabels,
  NATIONAL_ID: 'National ID',
  BIRTH_CERTIFICATE: 'Birth Certificate',
  PROOF_OF_ADDRESS: 'Proof of Address',
  INCOME_STATEMENT: 'Income Statement',
  MARRIAGE_CERTIFICATE: 'Marriage Certificate',
  DEATH_CERTIFICATE: 'Death Certificate',
  OTHER: 'Other',
  PASSPORT: 'Passport',
  PROFILE_PHOTO: 'Profile Photo',
  UTILITY_BILL: 'Utility Bill',
}

const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    UPLOADED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    VERIFIED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return styles[status] || styles.UPLOADED
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function DocumentsContent() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const familyUuid = user?.uuid || null

  // Data state
  const [members, setMembers] = useState<MemberInfo[]>([])
  const [documents, setDocuments] = useState<DocRecord[]>([])
  const [familyId, setFamilyId] = useState<string>('')

  // UI state
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noFamily, setNoFamily] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedHolder, setSelectedHolder] = useState(0)
  const [selectedType, setSelectedType] = useState(DOC_TYPES[0].value)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null) // document_id

  // Build holder options
  const holderOptions: HolderOption[] = familyUuid
    ? [
        { label: `Family — ${familyId || 'Main'}`, ownerType: 'family', ownerId: familyUuid },
        ...members.map(m => {
          const headTag = m.relationship_to_head === 'head' ? ' (Head)' : ''
          return {
            label: `${m.first_name} ${m.last_name}${headTag}`,
            ownerType: 'member' as const,
            ownerId: m.uuid,
          }
        }),
      ]
    : []

  // ─────────────────────────────────────────────────────────────────────
  // FETCH: family info + members + all documents
  // ─────────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!familyUuid) {
      setIsLoading(false)
      setError('No family associated with this account. Please log in.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // 1. Fetch family + members
      const famRes = await authFetch(`/families/${familyUuid}`)
      const famJson = await famRes.json()

      if (famRes.status === 404 || (famJson && famJson.error?.toLowerCase?.().includes('not found'))) {
        setNoFamily(true)
        setIsLoading(false)
        return
      }

      if (!famRes.ok || !famJson.success) {
        throw new Error(extractApiError(famJson.error, 'Failed to load family data'))
      }

      const famMembers: MemberInfo[] = (famJson.data.members || []).map((m: MemberInfo & { uuid: string }) => ({
        uuid: m.uuid,
        first_name: m.first_name,
        last_name: m.last_name,
        relationship_to_head: m.relationship_to_head,
      }))
      setMembers(famMembers)
      setFamilyId(famJson.data.family_id || '')

      // 2. Fetch documents — family-level
      const allDocs: DocRecord[] = []

      const famDocRes = await authFetch(`/documents/family/${familyUuid}`)
      const famDocJson = await famDocRes.json()
      
      console.log('Family documents response:', { ok: famDocRes.ok, data: famDocJson })
      
      if (famDocRes.ok && famDocJson.success && famDocJson.data) {
        for (const d of famDocJson.data) {
          allDocs.push(normalizeDoc(d, 'FAMILY', familyUuid))
        }
      } else if (!famDocRes.ok) {
        console.warn('Failed to fetch family documents:', famDocJson)
      }

      // 3. Fetch documents — per member
      for (const m of famMembers) {
        const memDocRes = await authFetch(`/documents/member/${m.uuid}`)
        const memDocJson = await memDocRes.json()
        
        console.log(`Member ${m.uuid} documents response:`, { ok: memDocRes.ok, data: memDocJson })
        
        if (memDocRes.ok && memDocJson.success && memDocJson.data) {
          for (const d of memDocJson.data) {
            allDocs.push(normalizeDoc(d, 'MEMBER', m.uuid))
          }
        } else if (!memDocRes.ok) {
          console.warn(`Failed to fetch documents for member ${m.uuid}:`, memDocJson)
        }
      }
      
      console.log('Total documents loaded:', allDocs.length)

      setDocuments(allDocs)
    } catch (err) {
      console.error('Documents fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setIsLoading(false)
    }
  }, [familyUuid])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Normalize a doc from any API shape
  function normalizeDoc(d: Record<string, unknown>, ownerType: string, ownerId: string): DocRecord {
    // Resolve effective status from verification records if present
    const verifications = d.document_verification as Array<{ status: string; rejection_reason?: string }> | undefined
    let effectiveStatus = (d.status as string) || 'PENDING'
    let rejectionReason = d.rejection_reason as string | undefined

    if (verifications && verifications.length > 0) {
      const latest = verifications[verifications.length - 1]
      effectiveStatus = latest.status || effectiveStatus
      rejectionReason = latest.rejection_reason || rejectionReason
    }

    return {
      document_id: d.document_id as string,
      document_type: d.document_type as string,
      file_name: (d.file_name as string) || 'Unknown',
      file_path: d.file_path as string | undefined,
      file_url: d.file_url as string | undefined,
      mime_type: d.mime_type as string | undefined,
      owner_type: ownerType,
      owner_id: ownerId,
      status: effectiveStatus as DocumentStatus,
      rejection_reason: rejectionReason,
      uploaded_at: (d.uploaded_at as string) || new Date().toISOString(),
      document_verification: verifications,
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // UPLOAD
  // ─────────────────────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const holder = holderOptions[selectedHolder]
    if (!holder) return

    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('document_type', selectedType)

      const response = await authUpload(
        `${UPLOAD_API}/${holder.ownerType}/${holder.ownerId}/documents`,
        formData
      )
      const result = await response.json()

      if (result.success && result.data) {
        // Add to local state immediately
        setDocuments(prev => [
          ...prev,
          normalizeDoc(
            { ...result.data, file_name: result.data.file_name || file.name },
            holder.ownerType.toUpperCase(),
            holder.ownerId
          ),
        ])
      } else {
        setUploadError(extractApiError(result.error, 'Upload failed'))
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Network error during upload')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // DELETE with confirmation
  // ─────────────────────────────────────────────────────────────────────
  const handleDelete = async (doc: DocRecord) => {
    try {
      const ownerType = doc.owner_type.toLowerCase()
      const res = await authFetch(
        `${UPLOAD_API}/${ownerType}/${doc.owner_id}/documents/${doc.document_id}`,
        { method: 'DELETE' }
      )
      const result = await res.json()

      if (result.success) {
        setDocuments(prev => prev.filter(d => d.document_id !== doc.document_id))
      } else {
        setError(extractApiError(result.error, 'Failed to delete document'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error during delete')
    } finally {
      setDeleteConfirm(null)
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // RE-UPLOAD (for rejected docs)
  // ─────────────────────────────────────────────────────────────────────
  const handleReupload = async (doc: DocRecord, file: File) => {
    setUploading(true)
    setUploadError(null)

    try {
      // Delete old one first
      const ownerType = doc.owner_type.toLowerCase()
      await authFetch(
        `${UPLOAD_API}/${ownerType}/${doc.owner_id}/documents/${doc.document_id}`,
        { method: 'DELETE' }
      )

      // Upload new one
      const formData = new FormData()
      formData.append('file', file)
      formData.append('document_type', doc.document_type)

      const response = await authUpload(
        `${UPLOAD_API}/${ownerType}/${doc.owner_id}/documents`,
        formData
      )
      const result = await response.json()

      if (result.success && result.data) {
        setDocuments(prev => {
          const filtered = prev.filter(d => d.document_id !== doc.document_id)
          return [
            ...filtered,
            normalizeDoc(
              { ...result.data, file_name: result.data.file_name || file.name },
              doc.owner_type,
              doc.owner_id
            ),
          ]
        })
      } else {
        setUploadError(extractApiError(result.error, 'Re-upload failed'))
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Network error during re-upload')
    } finally {
      setUploading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────
  const getTypeLabel = (val: string) => allTypeLabels[val] || val

  const getHolderLabel = (doc: DocRecord) => {
    if (doc.owner_type === 'FAMILY') return `Family — ${familyId}`
    const m = members.find(mm => mm.uuid === doc.owner_id)
    if (m) {
      const headTag = m.relationship_to_head === 'head' ? ' (Head)' : ''
      return `${m.first_name} ${m.last_name}${headTag}`
    }
    return 'Member'
  }

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-2">progress_activity</span>
          <p className="text-gray-600 dark:text-gray-400">Loading documents…</p>
        </div>
      </div>
    )
  }

  if (noFamily) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-8 text-center">
            <span className="material-symbols-outlined text-5xl text-amber-500 mb-4 block">family_restroom</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Family Registered</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You need to register your family before you can upload or view documents.
            </p>
            <button
              onClick={() => navigate('/register')}
              className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined">add</span>
              Register Family
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (error && !familyUuid) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-3xl mx-auto bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <span className="material-symbols-outlined text-3xl text-red-500 mb-2">error</span>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Documents</h1>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
            {documents.length} total
          </span>
        </header>

        {error && (
          <div className="mb-6 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 font-medium underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ─── Upload Section ─── */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Upload Document</h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="doc-holder" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Document Holder
                </label>
                <select
                  id="doc-holder"
                  value={selectedHolder}
                  onChange={(e) => setSelectedHolder(Number(e.target.value))}
                  className="w-full h-12 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 focus:ring-2 focus:ring-primary outline-none text-sm text-gray-900 dark:text-white"
                >
                  {holderOptions.map((opt, i) => (
                    <option key={opt.ownerId} value={i}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="doc-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Document Type
                </label>
                <select
                  id="doc-type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full h-12 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 focus:ring-2 focus:ring-primary outline-none text-sm text-gray-900 dark:text-white"
                >
                  {DOC_TYPES.map(dt => (
                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* File picker + upload */}
            <div>
              <label htmlFor="doc-file" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Choose File
              </label>
              <input
                id="doc-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx"
                onChange={handleUpload}
                disabled={uploading || holderOptions.length === 0}
                className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:font-medium file:cursor-pointer hover:file:bg-primary/90 disabled:opacity-50"
              />
            </div>

            {uploading && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                <span>Uploading…</span>
              </div>
            )}

            {uploadError && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
                {uploadError}
                <button onClick={() => setUploadError(null)} className="ml-2 font-medium underline">
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ─── Document Status Section ─── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Document Status</h2>
            <button
              onClick={fetchAll}
              disabled={isLoading}
              className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Refresh
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-3">description</span>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No documents uploaded yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Use the upload form above to add your first document
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.document_id}
                  className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white truncate">
                        {getTypeLabel(doc.document_type)}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {getHolderLabel(doc)} — {doc.file_name}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider shrink-0 ml-2 ${getStatusBadge(doc.status)}`}>
                      {doc.status}
                    </span>
                  </div>

                  {doc.status === 'REJECTED' && doc.rejection_reason && (
                    <div className="mt-2 text-xs text-red-600 dark:text-red-400 italic flex items-start gap-1">
                      <span className="material-symbols-outlined text-sm">error</span>
                      <span>&ldquo;{doc.rejection_reason}&rdquo;</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-xs text-gray-400">
                      {new Date(doc.uploaded_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <div className="flex gap-4">
                      {/* View button */}
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary text-sm font-semibold flex items-center gap-1 hover:underline"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          <span>View</span>
                        </a>
                      )}

                      {/* Re-upload for rejected */}
                      {doc.status === 'REJECTED' && (
                        <label className="text-primary text-sm font-semibold flex items-center gap-1 hover:underline cursor-pointer">
                          <span className="material-symbols-outlined text-sm">edit</span>
                          <span>Re-upload</span>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleReupload(doc, file)
                              e.target.value = ''
                            }}
                          />
                        </label>
                      )}

                      {/* Remove */}
                      {deleteConfirm === doc.document_id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Delete?</span>
                          <button
                            onClick={() => handleDelete(doc)}
                            className="text-red-600 text-xs font-bold hover:underline"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-gray-500 text-xs font-bold hover:underline"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(doc.document_id)}
                          className="text-red-500 text-sm font-semibold flex items-center gap-1 hover:underline"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
