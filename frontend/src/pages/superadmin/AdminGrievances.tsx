/**
 * ADMIN GRIEVANCES PAGE
 * 
 * Table with status dropdown, View/Edit/Archive actions
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
  ConfirmDialog,
  ActionButton,
  Badge,
  usePagination,
  useSort,
  type Column,
} from '@/components/admin/shared'
import {
  grievances,
  formatDate,
  exportToCSV,
  type AdminGrievance,
  type GrievanceStatus,
  type GrievanceCategory,
  type GrievancePriority,
} from '@/mock/superAdminMockData'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'

function getStatusVariant(status: GrievanceStatus): BadgeVariant {
  switch (status) {
    case 'OPEN': return 'info'
    case 'IN_PROGRESS': return 'warning'
    case 'RESOLVED': return 'success'
    case 'CLOSED': return 'default'
    case 'ESCALATED': return 'error'
    default: return 'default'
  }
}

function getPriorityVariant(priority: GrievancePriority): BadgeVariant {
  switch (priority) {
    case 'CRITICAL': return 'error'
    case 'HIGH': return 'error'
    case 'MEDIUM': return 'warning'
    case 'LOW': return 'default'
    default: return 'default'
  }
}

function getCategoryLabel(category: GrievanceCategory): string {
  const labels: Record<GrievanceCategory, string> = {
    PAYMENT_ISSUE: 'Payment Issue',
    ELIGIBILITY_DISPUTE: 'Eligibility Dispute',
    SERVICE_COMPLAINT: 'Service Complaint',
    STAFF_CONDUCT: 'Staff Conduct',
    DATA_CORRECTION: 'Data Correction',
    OTHER: 'Other',
  }
  return labels[category]
}

export default function AdminGrievances() {
  // Pure permission-based checks from JWT - no role names!
  const { hasPermission } = useAuthStore()
  
  const canEdit = hasPermission('ADMIN.GRIEVANCES.EDIT')
  const canArchive = hasPermission('ADMIN.GRIEVANCES.ARCHIVE')
  const canExport = hasPermission('ADMIN.AUDITLOGS.EXPORT')

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  
  // Local state for mock updates
  const [localGrievances, setLocalGrievances] = useState<AdminGrievance[]>(grievances)
  
  // Drawer state
  const [selectedGrievance, setSelectedGrievance] = useState<AdminGrievance | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  
  // Archive dialog state
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archiveReason, setArchiveReason] = useState('')
  const [grievanceToArchive, setGrievanceToArchive] = useState<AdminGrievance | null>(null)

  // Filter grievances
  const filteredGrievances = useMemo(() => {
    return localGrievances.filter(grv => {
      const matchesSearch = !searchQuery ||
        grv.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        grv.familyId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        grv.familyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        grv.summary.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus = !statusFilter || grv.status === statusFilter
      const matchesPriority = !priorityFilter || grv.priority === priorityFilter
      const matchesCategory = !categoryFilter || grv.category === categoryFilter
      
      return matchesSearch && matchesStatus && matchesPriority && matchesCategory
    })
  }, [localGrievances, searchQuery, statusFilter, priorityFilter, categoryFilter])

  // Sort
  const { data: sortedGrievances, sortColumn, sortDirection, handleSort } = useSort(filteredGrievances, 'createdAt')

  // Pagination
  const pagination = usePagination(sortedGrievances, 10)

  // Table columns
  const columns: Column<AdminGrievance>[] = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
      render: (grv) => <span className="font-mono text-sm">{grv.id}</span>,
    },
    {
      key: 'familyId',
      label: 'Family',
      sortable: true,
      render: (grv) => (
        <div>
          <p className="font-medium">{grv.familyName}</p>
          <p className="text-xs text-gray-500">{grv.familyId}</p>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (grv) => getCategoryLabel(grv.category),
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (grv) => <Badge variant={getPriorityVariant(grv.priority)}>{grv.priority}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (grv) => (
        <div onClick={(e) => e.stopPropagation()}>
          {canEdit ? (
            <select
              value={grv.status}
              onChange={(e) => handleStatusChange(grv.id, e.target.value as GrievanceStatus)}
              className="px-2 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
              <option value="ESCALATED">Escalated</option>
            </select>
          ) : (
            <Badge variant={getStatusVariant(grv.status)}>{grv.status.replace('_', ' ')}</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'assignedAdmin',
      label: 'Assigned To',
      render: (grv) => grv.assignedAdmin || <span className="text-gray-400">Unassigned</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (grv) => formatDate(grv.createdAt, 'short'),
    },
    {
      key: 'slaDue',
      label: 'SLA Due',
      sortable: true,
      render: (grv) => {
        const isOverdue = new Date(grv.slaDue) < new Date() && grv.status !== 'RESOLVED' && grv.status !== 'CLOSED'
        return (
          <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
            {formatDate(grv.slaDue, 'short')}
            {isOverdue && <span className="ml-1 text-xs">⚠️</span>}
          </span>
        )
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (grv) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleView(grv)}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            title="View"
          >
            <span className="material-symbols-outlined text-lg">visibility</span>
          </button>
          {canEdit && (
            <button
              onClick={() => handleEdit(grv)}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
              title="Edit"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
            </button>
          )}
          {canArchive && (
            <button
              onClick={() => handleArchiveClick(grv)}
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
  const handleStatusChange = (grievanceId: string, newStatus: GrievanceStatus) => {
    setLocalGrievances(prev => 
      prev.map(grv => 
        grv.id === grievanceId 
          ? { ...grv, status: newStatus, resolvedAt: newStatus === 'RESOLVED' ? new Date().toISOString() : grv.resolvedAt }
          : grv
      )
    )
  }

  const handleView = (grv: AdminGrievance) => {
    setSelectedGrievance(grv)
    setDrawerOpen(true)
  }

  const handleEdit = (grv: AdminGrievance) => {
    alert(`Edit grievance: ${grv.id}`)
  }

  const handleArchiveClick = (grv: AdminGrievance) => {
    setGrievanceToArchive(grv)
    setArchiveReason('')
    setArchiveDialogOpen(true)
  }

  const handleArchiveConfirm = () => {
    if (grievanceToArchive && archiveReason) {
      setLocalGrievances(prev => prev.filter(g => g.id !== grievanceToArchive.id))
      setArchiveDialogOpen(false)
      setGrievanceToArchive(null)
      setArchiveReason('')
    }
  }

  const handleExport = () => {
    exportToCSV(
      filteredGrievances,
      'grievances_export',
      [
        { key: 'id', label: 'ID' },
        { key: 'familyId', label: 'Family ID' },
        { key: 'familyName', label: 'Family Name' },
        { key: 'category', label: 'Category' },
        { key: 'priority', label: 'Priority' },
        { key: 'status', label: 'Status' },
        { key: 'summary', label: 'Summary' },
        { key: 'assignedAdmin', label: 'Assigned To' },
        { key: 'createdAt', label: 'Created' },
        { key: 'slaDue', label: 'SLA Due' },
      ]
    )
  }

  const statusOptions = [
    { value: 'OPEN', label: 'Open' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'RESOLVED', label: 'Resolved' },
    { value: 'CLOSED', label: 'Closed' },
    { value: 'ESCALATED', label: 'Escalated' },
  ]

  const priorityOptions = [
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
  ]

  const categoryOptions = [
    { value: 'PAYMENT_ISSUE', label: 'Payment Issue' },
    { value: 'ELIGIBILITY_DISPUTE', label: 'Eligibility Dispute' },
    { value: 'SERVICE_COMPLAINT', label: 'Service Complaint' },
    { value: 'STAFF_CONDUCT', label: 'Staff Conduct' },
    { value: 'DATA_CORRECTION', label: 'Data Correction' },
    { value: 'OTHER', label: 'Other' },
  ]

  // Stats
  const openCount = localGrievances.filter(g => g.status === 'OPEN').length
  const inProgressCount = localGrievances.filter(g => g.status === 'IN_PROGRESS').length
  const escalatedCount = localGrievances.filter(g => g.status === 'ESCALATED').length

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Grievances"
          subtitle={`${filteredGrievances.length} grievances in the system`}
          actions={
            canExport && (
              <ActionButton
                onClick={handleExport}
                icon="download"
                label="Export CSV"
                variant="secondary"
              />
            )
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-600 dark:text-blue-400">Open</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{openCount}</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-600 dark:text-amber-400">In Progress</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{inProgressCount}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">Escalated</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{escalatedCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-t-lg border border-b-0 border-gray-200 dark:border-gray-800 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by ID, family, or summary..."
              />
            </div>
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              placeholder="All Statuses"
            />
            <FilterSelect
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={priorityOptions}
              placeholder="All Priorities"
            />
            <FilterSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categoryOptions}
              placeholder="All Categories"
            />
          </div>
        </div>

        {/* Table */}
        <DataTable
          data={pagination.data}
          columns={columns}
          keyExtractor={(grv) => grv.id}
          onRowClick={handleView}
          emptyMessage="No grievances found"
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
          title={`Grievance ${selectedGrievance?.id}`}
          footer={
            <>
              {canEdit && (
                <ActionButton
                  onClick={() => selectedGrievance && handleEdit(selectedGrievance)}
                  icon="edit"
                  label="Edit"
                  variant="primary"
                />
              )}
              {canArchive && (
                <ActionButton
                  onClick={() => selectedGrievance && handleArchiveClick(selectedGrievance)}
                  icon="archive"
                  label="Archive"
                  variant="danger"
                />
              )}
            </>
          }
        >
          {selectedGrievance && (
            <div className="space-y-6">
              {/* Status and Priority */}
              <div className="flex items-center gap-2">
                <Badge variant={getStatusVariant(selectedGrievance.status)}>
                  {selectedGrievance.status.replace('_', ' ')}
                </Badge>
                <Badge variant={getPriorityVariant(selectedGrievance.priority)}>
                  {selectedGrievance.priority} Priority
                </Badge>
              </div>

              {/* Summary */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Summary
                </h3>
                <p className="text-gray-900 dark:text-white">{selectedGrievance.summary}</p>
              </div>

              {/* Family Info */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Family
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <p className="font-medium">{selectedGrievance.familyName}</p>
                  <p className="text-sm text-gray-500">{selectedGrievance.familyId}</p>
                </div>
              </div>

              {/* Details */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Category</p>
                    <p className="text-gray-900 dark:text-white">{getCategoryLabel(selectedGrievance.category)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Assigned To</p>
                    <p className="text-gray-900 dark:text-white">{selectedGrievance.assignedAdmin || 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Created</p>
                    <p className="text-gray-900 dark:text-white">{formatDate(selectedGrievance.createdAt, 'long')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">SLA Due</p>
                    <p className="text-gray-900 dark:text-white">{formatDate(selectedGrievance.slaDue, 'long')}</p>
                  </div>
                </div>
              </div>

              {/* Status Update */}
              {canEdit && (
                <div>
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                    Update Status
                  </h3>
                  <select
                    value={selectedGrievance.status}
                    onChange={(e) => {
                      handleStatusChange(selectedGrievance.id, e.target.value as GrievanceStatus)
                      setSelectedGrievance({ ...selectedGrievance, status: e.target.value as GrievanceStatus })
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                    <option value="ESCALATED">Escalated</option>
                  </select>
                </div>
              )}

              {selectedGrievance.resolvedAt && (
                <div>
                  <p className="text-xs text-gray-400">Resolved At</p>
                  <p className="text-gray-900 dark:text-white">{formatDate(selectedGrievance.resolvedAt, 'long')}</p>
                </div>
              )}
            </div>
          )}
        </Drawer>

        {/* Archive Confirmation */}
        <ConfirmDialog
          isOpen={archiveDialogOpen}
          onClose={() => setArchiveDialogOpen(false)}
          onConfirm={handleArchiveConfirm}
          title="Archive Grievance"
          message={`Are you sure you want to archive grievance ${grievanceToArchive?.id}?`}
          confirmLabel="Archive"
          variant="danger"
          requireReason
          reason={archiveReason}
          onReasonChange={setArchiveReason}
        />
      </div>
    </div>
  )
}
