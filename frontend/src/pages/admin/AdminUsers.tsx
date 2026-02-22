/**
 * USERS PAGE — Citizens from the Family Service
 *
 * Lists family members (citizens) from the family_member table with
 * pagination, search, and filtering.
 *
 * NO MOCK DATA — everything comes from the family-service /api/v1/citizens endpoint.
 */

import { useState, useEffect, useCallback } from 'react'
import { citizensApi, type Citizen, type ListCitizensParams } from '@/services/api'
import {
  PageHeader,
  SearchInput,
  FilterSelect,
  DataTable,
  Pagination,
  Badge,
  type Column,
} from '@/components/admin/shared'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'

interface PaginationState {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getStatusVariant(status: string | null): BadgeVariant {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
    case 'ALIVE':
      return 'success'
    case 'PENDING':
      return 'warning'
    case 'INACTIVE':
    case 'DECEASED':
      return 'error'
    case 'SUSPENDED':
      return 'info'
    default:
      return 'default'
  }
}

function getGenderVariant(gender: string | null): BadgeVariant {
  switch (gender?.toUpperCase()) {
    case 'MALE':
      return 'info'
    case 'FEMALE':
      return 'primary'
    case 'OTHER':
      return 'warning'
    default:
      return 'default'
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function fullName(citizen: Citizen): string {
  return `${citizen.first_name || ''} ${citizen.last_name || ''}`.trim() || '—'
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SUSPENDED', label: 'Suspended' },
]

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminUsers() {
  // ── Data state ─────────────────────────────────────────────────────────
  const [citizens, setCitizens] = useState<Citizen[]>([])
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Filters ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [genderFilter, setGenderFilter] = useState('')

  // ── Debounced search ───────────────────────────────────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPagination((prev) => ({ ...prev, page: 1 }))
    }, 400)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  // ── Fetch citizens ─────────────────────────────────────────────────────
  const fetchCitizens = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params: ListCitizensParams = {
        page: pagination.page,
        limit: pagination.limit,
      }
      if (statusFilter) params.status = statusFilter
      if (genderFilter) params.gender = genderFilter
      if (debouncedSearch) params.search = debouncedSearch

      const res = await citizensApi.list(params)
      if (res.success) {
        setCitizens(res.data)
        setPagination((prev) => ({
          ...prev,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages,
        }))
      } else {
        setError('Failed to load citizens')
      }
    } catch (err: unknown) {
      console.error('Error fetching citizens:', err)
      const axiosErr = err as { response?: { status?: number } }
      if (axiosErr?.response?.status === 403) {
        setError('Access denied — you do not have permission to view citizens.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load citizens')
      }
    } finally {
      setIsLoading(false)
    }
  }, [pagination.page, pagination.limit, statusFilter, genderFilter, debouncedSearch])

  useEffect(() => {
    fetchCitizens()
  }, [fetchCitizens])

  // ── Reset page when filters change ─────────────────────────────────────
  const handleStatusChange = (val: string) => {
    setStatusFilter(val)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }
  const handleGenderChange = (val: string) => {
    setGenderFilter(val)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  // ── Table columns ─────────────────────────────────────────────────────
  const columns: Column<Citizen>[] = [
    {
      key: 'first_name',
      label: 'Name',
      sortable: true,
      render: (citizen) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            {fullName(citizen)}
          </p>
          {citizen.email && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{citizen.email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'member_id',
      label: 'Member ID',
      render: (citizen) => (
        <span className="font-mono text-xs text-gray-600 dark:text-gray-300">
          {citizen.member_id || '—'}
        </span>
      ),
    },
    {
      key: 'national_id',
      label: 'National ID',
      render: (citizen) => (
        <span className="font-mono text-xs text-gray-600 dark:text-gray-300">
          {citizen.national_id || '—'}
        </span>
      ),
    },
    {
      key: 'gender',
      label: 'Gender',
      render: (citizen) =>
        citizen.gender ? (
          <Badge variant={getGenderVariant(citizen.gender)}>
            {citizen.gender}
          </Badge>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'member_status',
      label: 'Status',
      render: (citizen) =>
        citizen.member_status ? (
          <Badge variant={getStatusVariant(citizen.member_status)}>
            {citizen.member_status}
          </Badge>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (citizen) => (
        <span className="text-sm">{citizen.phone || '—'}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Registered',
      sortable: true,
      render: (citizen) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatDate(citizen.created_at)}
        </span>
      ),
    },
  ]

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle={`${pagination.total} registered citizen${pagination.total !== 1 ? 's' : ''}`}
      />

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 mt-0.5">
            error
          </span>
          <div className="flex-1">
            <p className="text-red-700 dark:text-red-400 font-medium">{error}</p>
            <button
              onClick={fetchCitizens}
              className="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* ── Filters bar ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by name, email, national ID, or member ID…"
          />
        </div>
        <FilterSelect
          value={statusFilter}
          onChange={handleStatusChange}
          options={STATUS_OPTIONS}
          placeholder="All statuses"
        />
        <FilterSelect
          value={genderFilter}
          onChange={handleGenderChange}
          options={GENDER_OPTIONS}
          placeholder="All genders"
        />
      </div>

      {/* ── Data table ────────────────────────────────────────────────────── */}
      <DataTable<Citizen>
        data={citizens}
        columns={columns}
        keyExtractor={(c) => c.uuid}
        loading={isLoading}
        emptyMessage="No citizens found matching your filters."
      />

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={(page) =>
            setPagination((prev) => ({ ...prev, page }))
          }
        />
      )}
    </div>
  )
}
