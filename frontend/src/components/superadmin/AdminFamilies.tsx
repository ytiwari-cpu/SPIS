/**
 * ADMIN FAMILIES PAGE
 * 
 * Real API integration with familyApi
 * Table with search, filters, pagination
 * Actions: View, Edit, Archive (permission-based)
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { familyApi } from '@/services/familyApi'
import { useAuthStore } from '@/store/authStore'
import { useToast } from '@/components/ui/Toast'
import type { DbFamily } from '@/types/database'
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterSelect,
  Pagination,
  Drawer,
  ConfirmDialog,
  ActionButton,
  ExportDropdown,
  ImportModal,
  Badge,
  usePagination,
  useSort,
  type Column,
  type ImportColumn,
} from '@/components/admin/shared'
import { formatDate, exportToCSV } from '@/mock/superAdminMockData'
import { exportToExcel } from '@/utils/excelUtils'
import ActiveArchiveTabs from '@/components/common/ActiveArchiveTabs'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'

function getStatusVariant(status: string): BadgeVariant {
  const statusLower = status?.toLowerCase() || ''
  if (['verified', 'active', 'approved'].includes(statusLower)) return 'success'
  if (['pending', 'pending_verification', 'submitted', 'draft'].includes(statusLower)) return 'warning'
  if (['rejected', 'suspended', 'inactive'].includes(statusLower)) return 'error'
  return 'default'
}

export default function AdminFamiliesContent() {
  const navigate = useNavigate()
  const { toast } = useToast()
  // Pure permission-based checks from JWT - no role names!
  const { hasPermission } = useAuthStore()
  
  // Map specific actions to JWT permissions
  const canEdit = hasPermission('ADMIN.FAMILIES.EDIT')
  const canArchive = hasPermission('ADMIN.FAMILIES.ARCHIVE')
  const canExport = useAuthStore(state => state.hasExplicitPermission('SYSTEM.EXPORT'))
  const canRestore = hasPermission('ADMIN.FAMILIES.ARCHIVE')
  const canImport = hasPermission('ADMIN.FAMILIES.EDIT')

  // State
  const [families, setFamilies] = useState<DbFamily[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  // Region filter available for future use
  const [regionFilter] = useState('')
  
  // Drawer state
  const [selectedFamily, setSelectedFamily] = useState<DbFamily | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  
  // Archive dialog state
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archiveReason, setArchiveReason] = useState('')
  const [familyToArchive, setFamilyToArchive] = useState<DbFamily | null>(null)

  // Fetch families
  useEffect(() => {
    fetchFamilies(showArchived)
  }, [showArchived])

  const fetchFamilies = async (archived = false) => {
    setLoading(true)
    setError(null)
    try {
      const params = archived ? { limit: 100, status: 'archived' } : { limit: 100 }
      const response = await familyApi.list(params)
      if (response.success && response.data) {
        setFamilies(response.data)
      } else {
        setError('Failed to load families')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load families')
    } finally {
      setLoading(false)
    }
  }

  // Filter families
  const filteredFamilies = useMemo(() => {
    return families.filter(family => {
      // In active tab, exclude archived families (registration form leaves status NULL)
      if (!showArchived && family.status === 'archived') return false

      const matchesSearch = !searchQuery || 
        family.family_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        family.head_first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        family.head_last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        family.phone?.includes(searchQuery)
      
      const matchesStatus = !statusFilter || family.status === statusFilter || family.registration_status === statusFilter
      
      // For region filter, we'd need address data - using a placeholder
      const matchesRegion = !regionFilter // TODO: Add region filtering when address data available
      
      return matchesSearch && matchesStatus && matchesRegion
    })
  }, [families, searchQuery, statusFilter, regionFilter, showArchived])

  // Sorting
  const { data: sortedFamilies, sortColumn, sortDirection, handleSort } = useSort(filteredFamilies, 'family_id')

  // Pagination
  const pagination = usePagination(sortedFamilies, 10)

  // Table columns
  const columns: Column<DbFamily>[] = [
    {
      key: 'family_id',
      label: 'Family ID',
      sortable: true,
      render: (family) => (
        <span className="font-mono font-medium text-primary">{family.family_id}</span>
      ),
    },
    {
      key: 'head_name',
      label: 'Head of Family',
      sortable: true,
      render: (family) => (
        <div>
          <p className="font-medium">{family.head_first_name} {family.head_last_name}</p>
          {family.head_national_id && (
            <p className="text-xs text-gray-500">ID: {family.head_national_id}</p>
          )}
        </div>
      ),
    },
    {
      key: 'household_size',
      label: 'Members',
      sortable: true,
      render: (family) => (
        <span className="inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-sm text-gray-400">group</span>
          {family.household_size || 1}
        </span>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (family) => family.phone || '—',
    },
    {
      key: 'programme',
      label: 'Programme',
      render: (family) => family.programme ? (
        <Badge variant="primary">{family.programme}</Badge>
      ) : '—',
    },
    {
      key: 'registration_status',
      label: 'Status',
      sortable: true,
      render: (family) => (
        <Badge variant={getStatusVariant(family.registration_status || '')}>
          {(family.registration_status || 'Unknown').replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'updated_at',
      label: 'Last Updated',
      sortable: true,
      render: (family) => formatDate(family.updated_at || family.created_at, 'relative'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (family) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleView(family)}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            title="View details"
          >
            <span className="material-symbols-outlined text-lg">visibility</span>
          </button>
          {canEdit && !showArchived && (
            <button
              onClick={() => handleEdit(family)}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
              title="Edit"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
            </button>
          )}
          {canArchive && !showArchived && !showArchived && (
            <button
              onClick={() => handleArchiveClick(family)}
              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
              title="Archive"
            >
              <span className="material-symbols-outlined text-lg">archive</span>
            </button>
          )}
          {canRestore && showArchived && (
            <button
              onClick={() => handleRestore(family)}
              className="p-1.5 rounded hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400"
              title="Restore"
            >
              <span className="material-symbols-outlined text-lg">restore_from_trash</span>
            </button>
          )}
        </div>
      ),
    },
  ]

  // Handlers
  const handleView = (family: DbFamily) => {
    setSelectedFamily(family)
    setDrawerOpen(true)
  }

  const handleEdit = (family: DbFamily) => {
    navigate(`/family/edit?id=${family.uuid}`)
  }

  const handleArchiveClick = (family: DbFamily) => {
    setFamilyToArchive(family)
    setArchiveReason('')
    setArchiveDialogOpen(true)
  }

  const handleArchiveConfirm = async () => {
    if (familyToArchive && archiveReason) {
      try {
        await familyApi.update(familyToArchive.uuid, { status: 'archived' })
        toast.success(`Family ${familyToArchive.family_id} archived successfully`)
        setArchiveDialogOpen(false)
        setFamilyToArchive(null)
        setArchiveReason('')
        fetchFamilies(showArchived)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to archive family'
        toast.error(message)
      }
    }
  }

  const handleRestore = async (family: DbFamily) => {
    try {
      await familyApi.update(family.uuid, { status: 'active' })
      toast.success(`Family ${family.family_id} restored successfully`)
      fetchFamilies(showArchived)
      setDrawerOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to restore family'
      toast.error(message)
    }
  }

  const handleExport = () => {
    exportToCSV(
      filteredFamilies,
      'families_export',
      [
        { key: 'family_id', label: 'Family ID' },
        { key: 'head_first_name', label: 'First Name' },
        { key: 'head_last_name', label: 'Last Name' },
        { key: 'phone', label: 'Phone' },
        { key: 'household_size', label: 'Members' },
        { key: 'registration_status', label: 'Status' },
        { key: 'programme', label: 'Programme' },
        { key: 'created_at', label: 'Created' },
      ]
    )
  }

  const exportColumns = [
    { key: 'family_id' as keyof DbFamily, label: 'Family ID' },
    { key: 'head_first_name' as keyof DbFamily, label: 'First Name' },
    { key: 'head_last_name' as keyof DbFamily, label: 'Last Name' },
    { key: 'phone' as keyof DbFamily, label: 'Phone' },
    { key: 'household_size' as keyof DbFamily, label: 'Members' },
    { key: 'registration_status' as keyof DbFamily, label: 'Status' },
    { key: 'programme' as keyof DbFamily, label: 'Programme' },
    { key: 'created_at' as keyof DbFamily, label: 'Created' },
  ]

  const handleExportExcel = () => {
    exportToExcel(filteredFamilies, 'families_export', exportColumns)
  }

  const importColumns: ImportColumn[] = [
    { key: 'head_first_name', label: 'First Name', required: true, type: 'string', min: 2, max: 50 },
    { key: 'head_last_name', label: 'Last Name', required: true, type: 'string', min: 2, max: 50 },
    { key: 'head_national_id', label: 'National ID', required: true, type: 'string', min: 5, max: 20 },
    { key: 'phone', label: 'Phone', required: true, type: 'phone' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'household_size', label: 'Household Size', required: true, type: 'number', min: 1, max: 20 },
    { key: 'programme', label: 'Programme', type: 'string' },
  ]

  const handleImportFamilies = (rows: Record<string, unknown>[]) => {
    // In production this would call familyApi.create() for each row.
    // For now we optimistically append to local state as placeholder records.
    const imported: DbFamily[] = rows.map((row, i) => ({
      uuid: `import_${Date.now()}_${i}`,
      family_id: `IMP-${Date.now()}-${i}`,
      head_first_name: row.head_first_name,
      head_last_name: row.head_last_name,
      head_national_id: row.head_national_id,
      phone: row.phone,
      email: row.email || null,
      household_size: Number(row.household_size) || 1,
      programme: row.programme || null,
      registration_status: 'draft',
      status: 'active',
      vulnerability_flag: false,
      intake_channel: 'BULK_IMPORT',
      geo_code: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      submitted_at: null,
      verified_at: null,
    } as unknown as DbFamily))
    setFamilies(prev => [...imported, ...prev])
  }

  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'pending_verification', label: 'Pending Verification' },
    { value: 'SUBMITTED', label: 'Submitted' },
    { value: 'verified', label: 'Verified' },
    { value: 'VERIFIED', label: 'Verified' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'REJECTED', label: 'Rejected' },
  ]

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Families"
          subtitle={showArchived ? `${filteredFamilies.length} archived families` : `${filteredFamilies.length} active families`}
          actions={
            <div className="flex items-center gap-3">
              {/* Active / Archived Tab Toggle */}
              <ActiveArchiveTabs
                isArchived={showArchived}
                onToggle={(archived) => { setShowArchived(archived); setStatusFilter('') }}
              />
              {canExport && (
                <ExportDropdown
                  onExportCSV={handleExport}
                  onExportExcel={handleExportExcel}
                  onImport={canImport && !showArchived ? () => setImportModalOpen(true) : undefined}
                />
              )}
            </div>
          }
        />

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
            <button 
              onClick={() => fetchFamilies(showArchived)}
              className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-t-lg border border-b-0 border-gray-200 dark:border-gray-800 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={showArchived ? 'Search archived families...' : 'Search by ID, name, or phone...'}
              />
            </div>
            {!showArchived && (
              <FilterSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusOptions}
                placeholder="All Status"
              />
            )}
          </div>
        </div>

        {/* Table */}
        <DataTable
          data={pagination.data}
          columns={columns}
          keyExtractor={(family) => family.uuid}
          onRowClick={handleView}
          loading={loading}
          emptyMessage="No families found"
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
        />

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            itemsPerPage={pagination.itemsPerPage}
            onPageChange={pagination.goToPage}
          />
        )}

        {/* Details Drawer */}
        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`Family Details - ${selectedFamily?.family_id}`}
          footer={
            <>
              {!showArchived && canEdit && (
                <ActionButton
                  onClick={() => selectedFamily && handleEdit(selectedFamily)}
                  icon="edit"
                  label="Edit Family"
                  variant="primary"
                />
              )}
              {!showArchived && canArchive && (
                <ActionButton
                  onClick={() => selectedFamily && handleArchiveClick(selectedFamily)}
                  icon="archive"
                  label="Archive"
                  variant="danger"
                />
              )}
              {showArchived && canRestore && (
                <ActionButton
                  onClick={() => selectedFamily && handleRestore(selectedFamily)}
                  icon="restore_from_trash"
                  label="Restore Family"
                  variant="primary"
                />
              )}
            </>
          }
        >
          {selectedFamily && (
            <div className="space-y-6">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <Badge variant={getStatusVariant(selectedFamily.registration_status || '')}>
                  {(selectedFamily.registration_status || 'Unknown').replace('_', ' ')}
                </Badge>
                {selectedFamily.vulnerability_flag && (
                  <Badge variant="error">Vulnerable</Badge>
                )}
              </div>

              {/* Head of Family */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Head of Family
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <p className="font-bold text-gray-900 dark:text-white">
                    {selectedFamily.head_first_name} {selectedFamily.head_last_name}
                  </p>
                  {selectedFamily.head_national_id && (
                    <p className="text-sm text-gray-500">National ID: {selectedFamily.head_national_id}</p>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Contact Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Phone</p>
                    <p className="text-gray-900 dark:text-white">{selectedFamily.phone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="text-gray-900 dark:text-white">{selectedFamily.email || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Family Details */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Family Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Household Size</p>
                    <p className="text-gray-900 dark:text-white">{selectedFamily.household_size || 1}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Programme</p>
                    <p className="text-gray-900 dark:text-white">{selectedFamily.programme || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Intake Channel</p>
                    <p className="text-gray-900 dark:text-white">{selectedFamily.intake_channel || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Geo Code</p>
                    <p className="text-gray-900 dark:text-white">{selectedFamily.geo_code || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Timeline
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created</span>
                    <span className="text-gray-900 dark:text-white">
                      {formatDate(selectedFamily.created_at, 'long')}
                    </span>
                  </div>
                  {selectedFamily.submitted_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Submitted</span>
                      <span className="text-gray-900 dark:text-white">
                        {formatDate(selectedFamily.submitted_at, 'long')}
                      </span>
                    </div>
                  )}
                  {selectedFamily.verified_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Verified</span>
                      <span className="text-gray-900 dark:text-white">
                        {formatDate(selectedFamily.verified_at, 'long')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Updated</span>
                    <span className="text-gray-900 dark:text-white">
                      {formatDate(selectedFamily.updated_at, 'long')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Drawer>

        {/* Archive Confirmation Dialog */}
        <ConfirmDialog
          isOpen={archiveDialogOpen}
          onClose={() => setArchiveDialogOpen(false)}
          onConfirm={handleArchiveConfirm}
          title="Archive Family"
          message={`Are you sure you want to archive family ${familyToArchive?.family_id}? This will remove them from active records.`}
          confirmLabel="Archive"
          variant="danger"
          requireReason
          reason={archiveReason}
          onReasonChange={setArchiveReason}
        />

        {/* Import Modal */}
        <ImportModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={handleImportFamilies}
          title="Import Families from Excel"
          columns={importColumns}
          templateFilename="families"
        />
      </div>
    </div>
  )
}
