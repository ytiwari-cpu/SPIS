/**
 * ADMIN CASE WORKERS LIST PAGE
 * 
 * Shows all case workers with stats and allows navigation to detail view.
 * Features:
 * - Table with name, email, status, assigned count, completed, pending, overdue
 * - Search and filter by status/region
 * - Click to view case worker details
 */

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterSelect,
  Pagination,
  Badge,
  StatCard,
  usePagination,
  useSort,
  type Column,
} from '@/components/admin/shared'
import {
  caseWorkers,
  formatDate,
  type CaseWorker,
  type CaseWorkerStatus,
} from '@/mock/superAdminMockData'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'

function getStatusVariant(status: CaseWorkerStatus): BadgeVariant {
  switch (status) {
    case 'ACTIVE': return 'success'
    case 'ON_LEAVE': return 'warning'
    case 'INACTIVE': return 'default'
    default: return 'default'
  }
}

function getStatusLabel(status: CaseWorkerStatus): string {
  switch (status) {
    case 'ACTIVE': return 'Active'
    case 'ON_LEAVE': return 'On Leave'
    case 'INACTIVE': return 'Inactive'
    default: return status
  }
}

export default function AdminCaseWorkers() {
  const navigate = useNavigate()
  // Pure permission-based check from JWT - no role names!
  const { hasPermission } = useAuthStore()
  const canView = hasPermission('ADMIN.CASEWORKERS.VIEW')

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')

  // Calculate totals
  const totals = useMemo(() => {
    const active = caseWorkers.filter(w => w.status === 'ACTIVE').length
    const totalAssigned = caseWorkers.reduce((sum, w) => sum + w.assignedCasesCount, 0)
    const totalCompleted = caseWorkers.reduce((sum, w) => sum + w.completedCasesCount, 0)
    const totalOverdue = caseWorkers.reduce((sum, w) => sum + w.overdueCasesCount, 0)
    return { active, totalAssigned, totalCompleted, totalOverdue }
  }, [])

  // Get unique regions for filter
  const regions = useMemo(() => {
    const uniqueRegions = [...new Set(caseWorkers.map(w => w.region))]
    return uniqueRegions.sort().map(r => ({ value: r, label: r }))
  }, [])

  // Filter workers
  const filteredWorkers = useMemo(() => {
    return caseWorkers.filter(worker => {
      const matchesSearch = !searchQuery ||
        worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        worker.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        worker.id.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus = !statusFilter || worker.status === statusFilter
      const matchesRegion = !regionFilter || worker.region === regionFilter
      
      return matchesSearch && matchesStatus && matchesRegion
    })
  }, [searchQuery, statusFilter, regionFilter])

  // Sort
  const { data: sortedWorkers, sortColumn, sortDirection, handleSort } = useSort(filteredWorkers, 'name')

  // Pagination
  const pagination = usePagination(sortedWorkers, 10)

  // Table columns
  const columns: Column<CaseWorker>[] = [
    {
      key: 'name',
      label: 'Case Worker',
      sortable: true,
      render: (worker) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{worker.name}</p>
          <p className="text-sm text-gray-500">{worker.email}</p>
        </div>
      ),
    },
    {
      key: 'region',
      label: 'Region',
      sortable: true,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (worker) => (
        <Badge variant={getStatusVariant(worker.status)}>
          {getStatusLabel(worker.status)}
        </Badge>
      ),
    },
    {
      key: 'assignedCasesCount',
      label: 'Assigned',
      sortable: true,
      render: (worker) => (
        <span className="font-medium">{worker.assignedCasesCount}</span>
      ),
    },
    {
      key: 'pendingCasesCount',
      label: 'Pending',
      sortable: true,
      render: (worker) => (
        <span className={worker.pendingCasesCount > 0 ? 'text-amber-600 font-medium' : ''}>
          {worker.pendingCasesCount}
        </span>
      ),
    },
    {
      key: 'overdueCasesCount',
      label: 'Overdue',
      sortable: true,
      render: (worker) => (
        <span className={worker.overdueCasesCount > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
          {worker.overdueCasesCount}
        </span>
      ),
    },
    {
      key: 'completedCasesCount',
      label: 'Completed',
      sortable: true,
      render: (worker) => (
        <span className="text-green-600 font-medium">{worker.completedCasesCount}</span>
      ),
    },
    {
      key: 'lastLogin',
      label: 'Last Active',
      sortable: true,
      render: (worker) => (
        <span className="text-sm text-gray-500">
          {worker.lastLogin ? formatDate(worker.lastLogin, 'relative') : 'Never'}
        </span>
      ),
    },
    {
      key: 'id',
      label: '',
      render: (worker) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/admin/case-workers/${worker.id}`)
          }}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
        >
          <span className="material-symbols-outlined text-gray-500">chevron_right</span>
        </button>
      ),
    },
  ]

  const statusOptions = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'ON_LEAVE', label: 'On Leave' },
    { value: 'INACTIVE', label: 'Inactive' },
  ]

  if (!canView) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-red-500">block</span>
          <h1 className="text-2xl font-bold mt-4">Access Denied</h1>
          <p className="text-gray-500 mt-2">You don't have permission to view Case Workers.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Case Workers"
          subtitle="Manage case workers and their assignments"
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Active Workers"
            value={totals.active}
            icon="support_agent"
          />
          <StatCard
            label="Total Assigned"
            value={totals.totalAssigned}
            icon="assignment"
          />
          <StatCard
            label="Completed Cases"
            value={totals.totalCompleted}
            icon="task_alt"
          />
          <StatCard
            label="Overdue Cases"
            value={totals.totalOverdue}
            icon="warning"
            trend={totals.totalOverdue > 0 ? { value: totals.totalOverdue, positive: false } : undefined}
          />
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by name, email, or ID..."
              />
            </div>
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              placeholder="All Statuses"
            />
            <FilterSelect
              value={regionFilter}
              onChange={setRegionFilter}
              options={regions}
              placeholder="All Regions"
            />
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filteredWorkers.length} case worker{filteredWorkers.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Table */}
        <DataTable
          data={pagination.data}
          columns={columns}
          keyExtractor={(worker) => worker.id}
          emptyMessage="No case workers found"
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={(worker) => navigate(`/admin/case-workers/${worker.id}`)}
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
      </div>
    </div>
  )
}
