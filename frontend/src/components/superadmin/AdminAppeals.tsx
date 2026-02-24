/**
 * ADMIN APPEALS PAGE
 * 
 * Appeals table with review UI - Approve/Deny/Request Info
 * Permission-based controls
 */

import { useState, useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterSelect,
  Pagination,
  Drawer,
  Modal,
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
import {
  appeals,
  archivedRecords,
  formatDate,
  exportToCSV,
  type Appeal,
  type AppealStatus,
  type ArchivedRecord,
} from '@/mock/superAdminMockData'
import { exportToExcel } from '@/utils/excelUtils'
import ActiveArchiveTabs from '@/components/common/ActiveArchiveTabs'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'

function getStatusVariant(status: AppealStatus): BadgeVariant {
  switch (status) {
    case 'PENDING': return 'warning'
    case 'UNDER_REVIEW': return 'info'
    case 'APPROVED': return 'success'
    case 'DENIED': return 'error'
    case 'INFO_REQUESTED': return 'primary'
    default: return 'default'
  }
}

export default function AdminAppealsContent() {
  // Pure permission-based checks from JWT - no role names!
  const { hasPermission } = useAuthStore()
  
  const canEdit = hasPermission('ADMIN.APPEALS.EDIT')
  const canArchive = hasPermission('ADMIN.APPEALS.ARCHIVE')
  const canExport = useAuthStore(state => state.hasExplicitPermission('SYSTEM.EXPORT'))
  const canRestore = hasPermission('ADMIN.APPEALS.ARCHIVE')
  const canImport = hasPermission('ADMIN.APPEALS.EDIT')

  // State
  const [showArchived, setShowArchived] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [localArchivedAppeals, setLocalArchivedAppeals] = useState<ArchivedRecord[]>(
    archivedRecords.filter(r => r.recordType === 'APPEAL')
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  
  // Local state for mock updates
  const [localAppeals, setLocalAppeals] = useState<Appeal[]>(appeals)
  
  // Drawer state
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  
  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewAction, setReviewAction] = useState<'approve' | 'deny' | 'info_request'>('approve')
  const [reviewResolution, setReviewResolution] = useState('')
  
  // Archive dialog state
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archiveReason, setArchiveReason] = useState('')
  const [appealToArchive, setAppealToArchive] = useState<Appeal | null>(null)

  // Filter appeals
  const filteredAppeals = useMemo(() => {
    return localAppeals.filter(appeal => {
      const matchesSearch = !searchQuery ||
        appeal.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        appeal.familyId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        appeal.familyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        appeal.grievanceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        appeal.reason.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus = !statusFilter || appeal.status === statusFilter
      
      return matchesSearch && matchesStatus
    })
  }, [localAppeals, searchQuery, statusFilter])

  // Sort
  const { data: sortedAppeals, sortColumn, sortDirection, handleSort } = useSort(filteredAppeals, 'submittedAt')

  // Pagination
  const pagination = usePagination(sortedAppeals, 10)

  // Table columns
  const columns: Column<Appeal>[] = [
    {
      key: 'id',
      label: 'Appeal ID',
      sortable: true,
      render: (appeal) => <span className="font-mono text-sm">{appeal.id}</span>,
    },
    {
      key: 'grievanceId',
      label: 'Grievance',
      sortable: true,
      render: (appeal) => <span className="font-mono text-sm text-gray-500">{appeal.grievanceId}</span>,
    },
    {
      key: 'familyId',
      label: 'Family',
      sortable: true,
      render: (appeal) => (
        <div>
          <p className="font-medium">{appeal.familyName}</p>
          <p className="text-xs text-gray-500">{appeal.familyId}</p>
        </div>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (appeal) => (
        <p className="text-sm truncate max-w-xs" title={appeal.reason}>
          {appeal.reason}
        </p>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (appeal) => (
        <Badge variant={getStatusVariant(appeal.status)}>
          {appeal.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'reviewer',
      label: 'Reviewer',
      render: (appeal) => appeal.reviewer || <span className="text-gray-400">Unassigned</span>,
    },
    {
      key: 'submittedAt',
      label: 'Submitted',
      sortable: true,
      render: (appeal) => formatDate(appeal.submittedAt, 'short'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (appeal) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleView(appeal)}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            title="View"
          >
            <span className="material-symbols-outlined text-lg">visibility</span>
          </button>
          {canEdit && (appeal.status === 'PENDING' || appeal.status === 'UNDER_REVIEW') && (
            <button
              onClick={() => handleReviewClick(appeal)}
              className="p-1.5 rounded hover:bg-primary/10 text-primary"
              title="Review"
            >
              <span className="material-symbols-outlined text-lg">rate_review</span>
            </button>
          )}
          {canArchive && (
            <button
              onClick={() => handleArchiveClick(appeal)}
              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
              title="Archive"
            >
              <span className="material-symbols-outlined text-lg">archive</span>
            </button>
          )}
        </div>
      ),
    },
  ]

  // Handlers
  const handleView = (appeal: Appeal) => {
    setSelectedAppeal(appeal)
    setDrawerOpen(true)
  }

  const handleReviewClick = (appeal: Appeal) => {
    setSelectedAppeal(appeal)
    setReviewAction('approve')
    setReviewResolution('')
    setReviewModalOpen(true)
  }

  const handleReviewSubmit = () => {
    if (!selectedAppeal) return

    const newStatus: AppealStatus = 
      reviewAction === 'approve' ? 'APPROVED' :
      reviewAction === 'deny' ? 'DENIED' : 'INFO_REQUESTED'

    setLocalAppeals(prev =>
      prev.map(appeal =>
        appeal.id === selectedAppeal.id
          ? {
              ...appeal,
              status: newStatus,
              reviewer: 'Current User', // TODO: Get from auth context
              reviewerId: 'current-user',
              reviewedAt: new Date().toISOString(),
              resolution: reviewResolution,
            }
          : appeal
      )
    )

    setReviewModalOpen(false)
    setSelectedAppeal(null)
    setReviewResolution('')
  }

  const handleArchiveClick = (appeal: Appeal) => {
    setAppealToArchive(appeal)
    setArchiveReason('')
    setArchiveDialogOpen(true)
  }

  const handleArchiveConfirm = () => {
    if (appealToArchive && archiveReason) {
      setLocalAppeals(prev => prev.filter(a => a.id !== appealToArchive.id))
      setArchiveDialogOpen(false)
      setAppealToArchive(null)
      setArchiveReason('')
    }
  }

  const handleRestoreAppeal = (record: ArchivedRecord) => {
    setLocalArchivedAppeals(prev => prev.filter(r => r.id !== record.id))
  }

  const exportColumns = [
    { key: 'id' as keyof Appeal, label: 'Appeal ID' },
    { key: 'grievanceId' as keyof Appeal, label: 'Grievance ID' },
    { key: 'familyId' as keyof Appeal, label: 'Family ID' },
    { key: 'familyName' as keyof Appeal, label: 'Family Name' },
    { key: 'reason' as keyof Appeal, label: 'Reason' },
    { key: 'status' as keyof Appeal, label: 'Status' },
    { key: 'reviewer' as keyof Appeal, label: 'Reviewer' },
    { key: 'submittedAt' as keyof Appeal, label: 'Submitted' },
    { key: 'reviewedAt' as keyof Appeal, label: 'Reviewed' },
    { key: 'resolution' as keyof Appeal, label: 'Resolution' },
  ]

  const handleExportExcel = () => {
    exportToExcel(filteredAppeals, 'appeals_export', exportColumns)
  }

  const importColumns: ImportColumn[] = [
    { key: 'familyId', label: 'Family ID', required: true, type: 'string' },
    { key: 'familyName', label: 'Family Name', required: true, type: 'string', min: 2, max: 100 },
    { key: 'grievanceId', label: 'Grievance ID', required: true, type: 'string' },
    { key: 'reason', label: 'Reason', required: true, type: 'string', min: 10, max: 1000 },
  ]

  const handleImportAppeals = (rows: Record<string, unknown>[]) => {
    const imported: Appeal[] = rows.map((row, i) => ({
      id: `apl_import_${Date.now()}_${i}`,
      familyId: String(row.familyId ?? ''),
      familyName: String(row.familyName ?? ''),
      grievanceId: String(row.grievanceId ?? ''),
      reason: String(row.reason ?? ''),
      status: 'PENDING' as AppealStatus,
      reviewer: null,
      reviewerId: null,
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      resolution: null,
    }))
    setLocalAppeals(prev => [...imported, ...prev])
  }

  const handleExport = () => {
    exportToCSV(
      filteredAppeals,
      'appeals_export',
      exportColumns
    )
  }

  const statusOptions = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'UNDER_REVIEW', label: 'Under Review' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'DENIED', label: 'Denied' },
    { value: 'INFO_REQUESTED', label: 'Info Requested' },
  ]

  // Stats
  const pendingCount = localAppeals.filter(a => a.status === 'PENDING').length
  const underReviewCount = localAppeals.filter(a => a.status === 'UNDER_REVIEW').length
  const infoRequestedCount = localAppeals.filter(a => a.status === 'INFO_REQUESTED').length

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Appeals"
          subtitle={
            showArchived
              ? `${localArchivedAppeals.length} archived appeals`
              : `${filteredAppeals.length} active appeals`
          }
          actions={
            <div className="flex items-center gap-3">
              {/* Active / Archived Tab Toggle */}
              <ActiveArchiveTabs
                isArchived={showArchived}
                onToggle={setShowArchived}
              />
              {canExport && !showArchived && (
                <ExportDropdown
                  onExportCSV={handleExport}
                  onExportExcel={handleExportExcel}
                  onImport={canImport ? () => setImportModalOpen(true) : undefined}
                />
              )}
            </div>
          }
        />

        {/* Stats — only in active view */}
        {!showArchived && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-600 dark:text-amber-400">Pending</p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{pendingCount}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-600 dark:text-blue-400">Under Review</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{underReviewCount}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <p className="text-sm text-purple-600 dark:text-purple-400">Info Requested</p>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{infoRequestedCount}</p>
            </div>
          </div>
        )}

        {/* Archived Appeals Table */}
        {showArchived ? (
          <>
            {localArchivedAppeals.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-12 text-center">
                <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 mb-3 block">archive</span>
                <p className="text-gray-500 dark:text-gray-400">No archived appeals</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Appeal</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reason</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Archived By</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Archived Date</th>
                      {canRestore && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {localArchivedAppeals.map(record => (
                      <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-white">{record.originalName}</p>
                          <p className="text-xs text-gray-500 font-mono">{record.originalId}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs">
                          <p className="truncate" title={record.archivedReason}>{record.archivedReason}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{record.archivedBy}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(record.archivedAt, 'short')}</td>
                        {canRestore && (
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleRestoreAppeal(record)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                            >
                              <span className="material-symbols-outlined text-base">restore_from_trash</span>
                              Restore
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (<>
        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-t-lg border border-b-0 border-gray-200 dark:border-gray-800 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by ID, family, or reason..."
              />
            </div>
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              placeholder="All Statuses"
            />
          </div>
        </div>

        {/* Table */}
        <DataTable
          data={pagination.data}
          columns={columns}
          keyExtractor={(appeal) => appeal.id}
          onRowClick={handleView}
          emptyMessage="No appeals found"
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
          title={`Appeal ${selectedAppeal?.id}`}
          footer={
            canEdit && selectedAppeal && (selectedAppeal.status === 'PENDING' || selectedAppeal.status === 'UNDER_REVIEW') ? (
              <ActionButton
                onClick={() => {
                  setDrawerOpen(false)
                  handleReviewClick(selectedAppeal)
                }}
                icon="rate_review"
                label="Review Appeal"
                variant="primary"
              />
            ) : undefined
          }
        >
          {selectedAppeal && (
            <div className="space-y-6">
              {/* Status */}
              <div className="flex items-center gap-2">
                <Badge variant={getStatusVariant(selectedAppeal.status)}>
                  {selectedAppeal.status.replace('_', ' ')}
                </Badge>
              </div>

              {/* Reason */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Appeal Reason
                </h3>
                <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  {selectedAppeal.reason}
                </p>
              </div>

              {/* Related Info */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Related Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Grievance ID</p>
                    <p className="text-gray-900 dark:text-white font-mono">{selectedAppeal.grievanceId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Family</p>
                    <p className="text-gray-900 dark:text-white">{selectedAppeal.familyName}</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Timeline
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Submitted</span>
                    <span className="text-gray-900 dark:text-white">{formatDate(selectedAppeal.submittedAt, 'long')}</span>
                  </div>
                  {selectedAppeal.reviewedAt && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Reviewed</span>
                      <span className="text-gray-900 dark:text-white">{formatDate(selectedAppeal.reviewedAt, 'long')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Reviewer */}
              {selectedAppeal.reviewer && (
                <div>
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                    Reviewer
                  </h3>
                  <p className="text-gray-900 dark:text-white">{selectedAppeal.reviewer}</p>
                </div>
              )}

              {/* Resolution */}
              {selectedAppeal.resolution && (
                <div>
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                    Resolution
                  </h3>
                  <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    {selectedAppeal.resolution}
                  </p>
                </div>
              )}
            </div>
          )}
        </Drawer>

        {/* Review Modal */}
        <Modal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          title="Review Appeal"
          size="md"
        >
          {selectedAppeal && (
            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-2">Appeal from {selectedAppeal.familyName}</p>
                <p className="text-gray-900 dark:text-white">{selectedAppeal.reason}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Decision
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setReviewAction('approve')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-colors ${
                      reviewAction === 'approve'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 ring-2 ring-green-500'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg align-middle mr-2">check_circle</span>
                    Approve
                  </button>
                  <button
                    onClick={() => setReviewAction('deny')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-colors ${
                      reviewAction === 'deny'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 ring-2 ring-red-500'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg align-middle mr-2">cancel</span>
                    Deny
                  </button>
                  <button
                    onClick={() => setReviewAction('info_request')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-colors ${
                      reviewAction === 'info_request'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg align-middle mr-2">help</span>
                    Request Info
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Resolution Notes {reviewAction !== 'approve' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={reviewResolution}
                  onChange={(e) => setReviewResolution(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder={
                    reviewAction === 'approve'
                      ? 'Optional: Add notes about the approval...'
                      : reviewAction === 'deny'
                      ? 'Explain the reason for denial...'
                      : 'Specify what additional information is needed...'
                  }
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setReviewModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReviewSubmit}
                  disabled={reviewAction !== 'approve' && !reviewResolution.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Decision
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Archive Confirmation */}
        <ConfirmDialog
          isOpen={archiveDialogOpen}
          onClose={() => setArchiveDialogOpen(false)}
          onConfirm={handleArchiveConfirm}
          title="Archive Appeal"
          message={`Are you sure you want to archive appeal ${appealToArchive?.id}?`}
          confirmLabel="Archive"
          variant="danger"
          requireReason
          reason={archiveReason}
          onReasonChange={setArchiveReason}
        />
        </>)}

        {/* Import Modal */}
        <ImportModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={handleImportAppeals}
          title="Import Appeals from Excel"
          columns={importColumns}
          templateFilename="appeals"
        />
      </div>
    </div>
  )
}
