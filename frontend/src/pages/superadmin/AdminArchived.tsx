/**
 * ADMIN ARCHIVED RECORDS PAGE
 * 
 * Unified archived records table with type filter
 * Restore action (Super Admin only)
 */

import { useState, useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterSelect,
  Pagination,
  ConfirmDialog,
  Badge,
  usePagination,
  useSort,
  type Column,
} from '@/components/admin/shared'
import {
  archivedRecords as initialRecords,
  formatDate,
  type ArchivedRecord,
  type RecordType,
} from '@/mock/superAdminMockData'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'

function getRecordTypeVariant(type: RecordType): BadgeVariant {
  switch (type) {
    case 'FAMILY': return 'primary'
    case 'PROGRAMME': return 'success'
    case 'GRIEVANCE': return 'warning'
    case 'APPEAL': return 'info'
    default: return 'default'
  }
}

export default function AdminArchived() {
  // Pure permission-based checks from JWT - no role names!
  const { hasPermission } = useAuthStore()
  
  const canRestore = hasPermission('ADMIN.ARCHIVED.RESTORE')

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  
  // Local state for mock updates
  const [localRecords, setLocalRecords] = useState<ArchivedRecord[]>(initialRecords)
  
  // Restore dialog state
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [recordToRestore, setRecordToRestore] = useState<ArchivedRecord | null>(null)

  // Filter records
  const filteredRecords = useMemo(() => {
    return localRecords.filter(record => {
      const matchesSearch = !searchQuery ||
        record.originalId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.archivedReason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.archivedBy.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesType = !typeFilter || record.recordType === typeFilter
      
      return matchesSearch && matchesType
    })
  }, [localRecords, searchQuery, typeFilter])

  // Sort
  const { data: sortedRecords, sortColumn, sortDirection, handleSort } = useSort(filteredRecords, 'archivedAt')

  // Pagination
  const pagination = usePagination(sortedRecords, 10)

  // Table columns
  const columns: Column<ArchivedRecord>[] = [
    {
      key: 'recordType',
      label: 'Type',
      sortable: true,
      render: (record) => (
        <Badge variant={getRecordTypeVariant(record.recordType)}>
          {record.recordType}
        </Badge>
      ),
    },
    {
      key: 'originalId',
      label: 'Original ID',
      sortable: true,
      render: (record) => <span className="font-mono text-sm">{record.originalId}</span>,
    },
    {
      key: 'originalName',
      label: 'Name',
      sortable: true,
      render: (record) => <span className="font-medium">{record.originalName}</span>,
    },
    {
      key: 'archivedReason',
      label: 'Reason',
      render: (record) => (
        <p className="text-sm truncate max-w-xs" title={record.archivedReason}>
          {record.archivedReason}
        </p>
      ),
    },
    {
      key: 'archivedBy',
      label: 'Archived By',
      sortable: true,
      render: (record) => record.archivedBy,
    },
    {
      key: 'archivedAt',
      label: 'Archived Date',
      sortable: true,
      render: (record) => formatDate(record.archivedAt, 'short'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (record) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {canRestore && (
            <button
              onClick={() => handleRestoreClick(record)}
              className="p-1.5 rounded hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400"
              title="Restore"
            >
              <span className="material-symbols-outlined text-lg">restore</span>
            </button>
          )}
          <button
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            title="View Details"
            onClick={() => alert(`View archived record: ${record.originalId}`)}
          >
            <span className="material-symbols-outlined text-lg">visibility</span>
          </button>
        </div>
      ),
    },
  ]

  // Handlers
  const handleRestoreClick = (record: ArchivedRecord) => {
    setRecordToRestore(record)
    setRestoreDialogOpen(true)
  }

  const handleRestoreConfirm = () => {
    if (recordToRestore) {
      setLocalRecords(prev => prev.filter(r => r.id !== recordToRestore.id))
      setRestoreDialogOpen(false)
      setRecordToRestore(null)
      // In a real app, this would also add the record back to its original table
    }
  }

  const typeOptions = [
    { value: 'FAMILY', label: 'Families' },
    { value: 'PROGRAMME', label: 'Programmes' },
    { value: 'GRIEVANCE', label: 'Grievances' },
    { value: 'APPEAL', label: 'Appeals' },
  ]

  // Stats by type
  const familyCount = localRecords.filter(r => r.recordType === 'FAMILY').length
  const programmeCount = localRecords.filter(r => r.recordType === 'PROGRAMME').length
  const grievanceCount = localRecords.filter(r => r.recordType === 'GRIEVANCE').length
  const appealCount = localRecords.filter(r => r.recordType === 'APPEAL').length

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Archived Records"
          subtitle={`${filteredRecords.length} archived records in the system`}
        />

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <button
            onClick={() => setTypeFilter(typeFilter === 'FAMILY' ? '' : 'FAMILY')}
            className={`rounded-lg p-4 border transition-colors ${
              typeFilter === 'FAMILY'
                ? 'bg-primary/10 border-primary'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-primary/50'
            }`}
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">Families</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{familyCount}</p>
          </button>
          <button
            onClick={() => setTypeFilter(typeFilter === 'PROGRAMME' ? '' : 'PROGRAMME')}
            className={`rounded-lg p-4 border transition-colors ${
              typeFilter === 'PROGRAMME'
                ? 'bg-primary/10 border-primary'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-primary/50'
            }`}
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">Programmes</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{programmeCount}</p>
          </button>
          <button
            onClick={() => setTypeFilter(typeFilter === 'GRIEVANCE' ? '' : 'GRIEVANCE')}
            className={`rounded-lg p-4 border transition-colors ${
              typeFilter === 'GRIEVANCE'
                ? 'bg-primary/10 border-primary'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-primary/50'
            }`}
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">Grievances</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{grievanceCount}</p>
          </button>
          <button
            onClick={() => setTypeFilter(typeFilter === 'APPEAL' ? '' : 'APPEAL')}
            className={`rounded-lg p-4 border transition-colors ${
              typeFilter === 'APPEAL'
                ? 'bg-primary/10 border-primary'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-primary/50'
            }`}
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">Appeals</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{appealCount}</p>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-t-lg border border-b-0 border-gray-200 dark:border-gray-800 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by ID, name, reason, or archived by..."
              />
            </div>
            <FilterSelect
              value={typeFilter}
              onChange={setTypeFilter}
              options={typeOptions}
              placeholder="All Types"
            />
          </div>
        </div>

        {/* Table */}
        <DataTable
          data={pagination.data}
          columns={columns}
          keyExtractor={(record) => record.id}
          emptyMessage="No archived records found"
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

        {/* Restore Confirmation */}
        <ConfirmDialog
          isOpen={restoreDialogOpen}
          onClose={() => setRestoreDialogOpen(false)}
          onConfirm={handleRestoreConfirm}
          title="Restore Record"
          message={`Are you sure you want to restore ${recordToRestore?.originalName} (${recordToRestore?.originalId})? This will add it back to the active records.`}
          confirmLabel="Restore"
          variant="info"
        />

        {/* Info Box */}
        {!canRestore && (
          <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">
                info
              </span>
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Restore Permission Required
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Only Super Administrators can restore archived records. Contact your administrator if you need to restore a record.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
