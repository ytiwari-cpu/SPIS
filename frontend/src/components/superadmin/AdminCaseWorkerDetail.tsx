/**
 * ADMIN CASE WORKER DETAIL PAGE
 * 
 * Shows detailed view of a case worker with:
 * - Worker info header
 * - Workload Progress bar (segmented by status)
 * - Metrics cards (assigned, completed, pending, overdue)
 * - Assigned-by breakdown
 * - Assigned cases table with progress column and filters
 * - Assign case modal
 * 
 * PROGRESS DEFINITION:
 * Since our Case model uses statuses (not explicit steps), we map status to progress:
 * - OPEN: 0% (case just opened, no work started)
 * - IN_PROGRESS: 40% (actively being worked on)
 * - PENDING_REVIEW: 70% (awaiting review/approval)
 * - ON_HOLD: 25% (paused, minimal progress)
 * - COMPLETED: 100% (fully done)
 * - CLOSED: 100% (archived/closed)
 */

import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import {
  DataTable,
  SearchInput,
  FilterSelect,
  Pagination,
  Modal,
  Badge,
  StatCard,
  usePagination,
  useSort,
  type Column,
} from '@/components/admin/shared'
import {
  getCaseWorkerById,
  getCasesByWorkerId,
  getCaseWorkerStats,
  getUnassignedCases,
  assignCaseToWorker,
  formatDate,
  type Case,
  type CaseStatus,
} from '@/mock/superAdminMockData'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'

/**
 * Maps case status to progress percentage.
 * Progress is derived from workflow status since our model doesn't have explicit steps.
 */
function getStatusProgress(status: CaseStatus): number {
  switch (status) {
    case 'OPEN': return 0
    case 'IN_PROGRESS': return 40
    case 'PENDING_REVIEW': return 70
    case 'ON_HOLD': return 25
    case 'COMPLETED': return 100
    case 'CLOSED': return 100
    default: return 0
  }
}

function getCaseStatusVariant(status: CaseStatus): BadgeVariant {
  switch (status) {
    case 'COMPLETED': return 'success'
    case 'CLOSED': return 'default'
    case 'IN_PROGRESS': return 'info'
    case 'PENDING_REVIEW': return 'warning'
    case 'ON_HOLD': return 'warning'
    case 'OPEN': return 'primary'
    default: return 'default'
  }
}

function getPriorityVariant(priority: string): BadgeVariant {
  switch (priority) {
    case 'URGENT': return 'error'
    case 'HIGH': return 'warning'
    case 'MEDIUM': return 'info'
    case 'LOW': return 'default'
    default: return 'default'
  }
}

/**
 * Progress bar component for case progress visualization
 */
function ProgressBar({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const height = size === 'sm' ? 'h-1.5' : 'h-2'
  const bgColor = value >= 100 ? 'bg-green-500' : value >= 70 ? 'bg-blue-500' : value >= 40 ? 'bg-amber-500' : 'bg-gray-400'
  
  return (
    <div className={`w-full ${height} bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden`}>
      <div
        className={`${height} ${bgColor} transition-all duration-300`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  )
}

/**
 * Segmented progress bar showing distribution across statuses for a worker's cases
 */
function WorkloadProgressBar({ cases }: { cases: Case[] }) {
  const total = cases.length
  if (total === 0) return null

  // Calculate status counts
  const statusCounts: Record<CaseStatus, number> = {
    OPEN: 0,
    IN_PROGRESS: 0,
    PENDING_REVIEW: 0,
    ON_HOLD: 0,
    COMPLETED: 0,
    CLOSED: 0,
  }
  cases.forEach(c => {
    statusCounts[c.status]++
  })

  const segments: { status: CaseStatus; count: number; color: string; label: string }[] = [
    { status: 'COMPLETED', count: statusCounts['COMPLETED'] || 0, color: 'bg-green-500', label: 'Completed' },
    { status: 'CLOSED', count: statusCounts['CLOSED'] || 0, color: 'bg-gray-500', label: 'Closed' },
    { status: 'PENDING_REVIEW', count: statusCounts['PENDING_REVIEW'] || 0, color: 'bg-amber-500', label: 'Pending Review' },
    { status: 'IN_PROGRESS', count: statusCounts['IN_PROGRESS'] || 0, color: 'bg-blue-500', label: 'In Progress' },
    { status: 'ON_HOLD', count: statusCounts['ON_HOLD'] || 0, color: 'bg-orange-400', label: 'On Hold' },
    { status: 'OPEN', count: statusCounts['OPEN'] || 0, color: 'bg-gray-400', label: 'Open' },
  ]

  const completionRatio = Math.round(((statusCounts['COMPLETED'] + statusCounts['CLOSED']) / total) * 100)

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-gray-900 dark:text-white">Workload Progress</h2>
        <span className="text-sm text-gray-500">{completionRatio}% complete</span>
      </div>
      
      {/* Segmented Bar */}
      <div className="h-4 w-full flex rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 mb-3">
        {segments.map(seg => {
          const pct = (seg.count / total) * 100
          if (pct === 0) return null
          return (
            <div
              key={seg.status}
              className={`${seg.color} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ${seg.count} (${pct.toFixed(1)}%)`}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {segments.filter(s => s.count > 0).map(seg => (
          <div key={seg.status} className="flex items-center gap-1.5">
            <div className={`size-2.5 rounded-full ${seg.color}`} />
            <span className="text-gray-600 dark:text-gray-400">{seg.label}: {seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminCaseWorkerDetailContent() {
  const { workerId } = useParams<{ workerId: string }>()
  const navigate = useNavigate()
  // Pure permission-based check from JWT - no role names!
  const { hasPermission, session } = useAuthStore()
  const canAssign = hasPermission('ADMIN.CASEWORKERS.ASSIGN')

  // Get worker data
  const worker = useMemo(() => getCaseWorkerById(workerId || ''), [workerId])
  const workerCases = useMemo(() => getCasesByWorkerId(workerId || ''), [workerId])
  const stats = useMemo(() => getCaseWorkerStats(workerId || ''), [workerId])
  const unassignedCases = useMemo(() => getUnassignedCases(), [])

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)

  // Filter cases
  const filteredCases = useMemo(() => {
    return workerCases.filter(c => {
      const matchesSearch = !searchQuery ||
        c.caseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.familyName.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Handle special filters
      let matchesStatus = true
      if (statusFilter === 'OVERDUE') {
        matchesStatus = isOverdue(c)
      } else if (statusFilter === 'PENDING') {
        matchesStatus = c.status !== 'COMPLETED' && c.status !== 'CLOSED'
      } else if (statusFilter) {
        matchesStatus = c.status === statusFilter
      }
      
      return matchesSearch && matchesStatus
    })
  }, [workerCases, searchQuery, statusFilter])

  // Sort and paginate
  const { data: sortedCases, sortColumn, sortDirection, handleSort } = useSort(filteredCases, 'createdAt')
  const pagination = usePagination(sortedCases, 10)

  // Handle case assignment
  const handleAssignCase = useCallback(async () => {
    if (!selectedCaseId || !worker) return
    
    setAssigning(true)
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500))
      
      assignCaseToWorker(
        selectedCaseId,
        worker.id,
        session?.uuid || 'system',
        session?.family_id || 'System Admin'
      )
      
      setShowAssignModal(false)
      setSelectedCaseId(null)
      // Force re-render by navigating
      navigate(`/admin/case-workers/${worker.id}`, { replace: true })
    } finally {
      setAssigning(false)
    }
  }, [selectedCaseId, worker, session, navigate])

  // Check if case is overdue
  const isOverdue = (c: Case): boolean => {
    if (c.status === 'COMPLETED' || c.status === 'CLOSED') return false
    if (!c.dueDate) return false
    return new Date(c.dueDate) < new Date()
  }

  // Table columns - now includes Progress column
  const columns: Column<Case>[] = [
    {
      key: 'caseNumber',
      label: 'Case #',
      sortable: true,
      render: (c) => (
        <span className="font-mono text-sm">{c.caseNumber}</span>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (c) => (
        <div>
          <p className="font-medium">{c.title}</p>
          <p className="text-sm text-gray-500">{c.familyName}</p>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (c) => (
        <span className="text-sm">{c.type.replace('_', ' ')}</span>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (c) => <Badge variant={getPriorityVariant(c.priority)}>{c.priority}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (c) => <Badge variant={getCaseStatusVariant(c.status)}>{c.status.replace('_', ' ')}</Badge>,
    },
    {
      key: 'progress',
      label: 'Progress',
      render: (c) => {
        const progress = getStatusProgress(c.status)
        return (
          <div className="w-20">
            <div className="flex items-center gap-2">
              <ProgressBar value={progress} size="sm" />
              <span className="text-xs text-gray-500">{progress}%</span>
            </div>
          </div>
        )
      },
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      sortable: true,
      render: (c) => {
        const overdue = isOverdue(c)
        return (
          <span className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
            {c.dueDate ? formatDate(c.dueDate) : '—'}
            {overdue && (
              <span className="ml-1 text-xs text-red-500">(Overdue)</span>
            )}
          </span>
        )
      },
    },
    {
      key: 'assignedByName',
      label: 'Assigned By',
      render: (c) => <span className="text-sm">{c.assignedByName || '—'}</span>,
    },
    {
      key: 'assignedAt',
      label: 'Assigned',
      sortable: true,
      render: (c) => (
        <span className="text-sm text-gray-500">
          {c.assignedAt ? formatDate(c.assignedAt, 'relative') : '—'}
        </span>
      ),
    },
  ]

  const statusOptions = [
    { value: 'PENDING', label: 'All Pending' },
    { value: 'OVERDUE', label: 'Overdue' },
    { value: 'OPEN', label: 'Open' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'PENDING_REVIEW', label: 'Pending Review' },
    { value: 'ON_HOLD', label: 'On Hold' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CLOSED', label: 'Closed' },
  ]

  if (!worker) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-gray-400">person_off</span>
          <h1 className="text-2xl font-bold mt-4">Case Worker Not Found</h1>
          <p className="text-gray-500 mt-2">The case worker you're looking for doesn't exist.</p>
          <Link
            to="/admin/case-workers"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary text-white rounded-lg"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Case Workers
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Back button */}
        <Link
          to="/admin/case-workers"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary mb-4"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Case Workers
        </Link>

        {/* Header */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-primary">support_agent</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{worker.name}</h1>
                <p className="text-gray-500">{worker.email}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-gray-500">{worker.phone}</span>
                  <span className="text-gray-300">•</span>
                  <span className="text-sm text-gray-500">{worker.region}</span>
                  <Badge variant={worker.status === 'ACTIVE' ? 'success' : worker.status === 'ON_LEAVE' ? 'warning' : 'default'}>
                    {worker.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </div>
            {canAssign && worker.status === 'ACTIVE' && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Assign Case
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Assigned"
            value={stats.totalAssigned}
            icon="assignment"
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            icon="task_alt"
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            icon="pending"
          />
          <StatCard
            label="Overdue"
            value={stats.overdue}
            icon="warning"
            trend={stats.overdue > 0 ? { value: stats.overdue, positive: false } : undefined}
          />
        </div>

        {/* Workload Progress Bar */}
        {workerCases.length > 0 && (
          <WorkloadProgressBar cases={workerCases} />
        )}

        {/* Assigned By Breakdown */}
        {stats.assignedByBreakdown.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 mb-6">
            <h2 className="font-bold text-gray-900 dark:text-white mb-3">
              Cases Assigned By
            </h2>
            <div className="flex flex-wrap gap-3">
              {stats.assignedByBreakdown.map(item => (
                <div
                  key={item.assignerId}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <span className="material-symbols-outlined text-gray-500 text-sm">person</span>
                  <span className="text-sm font-medium">{item.assignerName}</span>
                  <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cases Table */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="font-bold text-gray-900 dark:text-white mb-4">Assigned Cases</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search cases..."
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

          <div className="p-4">
            <DataTable
              data={pagination.data}
              columns={columns}
              keyExtractor={(c) => c.id}
              emptyMessage="No cases assigned to this worker"
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
            />

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
      </div>

      {/* Assign Case Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false)
          setSelectedCaseId(null)
        }}
        title="Assign Case"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Select a case to assign to <strong>{worker.name}</strong>
          </p>

          {unassignedCases.length === 0 ? (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-4xl text-gray-400">inbox</span>
              <p className="mt-2 text-gray-500">No unassigned cases available</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2">
              {unassignedCases.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCaseId(c.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedCaseId === c.id
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{c.caseNumber}</p>
                      <p className="text-sm text-gray-500">{c.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getPriorityVariant(c.priority)}>{c.priority}</Badge>
                      {selectedCaseId === c.id && (
                        <span className="material-symbols-outlined text-primary">check_circle</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                    <span>{c.familyName}</span>
                    <span>•</span>
                    <span>Due: {c.dueDate ? formatDate(c.dueDate) : 'No due date'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={() => {
                setShowAssignModal(false)
                setSelectedCaseId(null)
              }}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleAssignCase}
              disabled={!selectedCaseId || assigning}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {assigning ? 'Assigning...' : 'Assign Case'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
