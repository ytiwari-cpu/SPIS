/**
 * SUPER ADMIN OVERVIEW PAGE
 * 
 * Dashboard overview with statistics, cases progress, and quick links.
 * 
 * PROGRESS DEFINITION:
 * Since our Case model uses statuses (not explicit steps), we map status to progress:
 * - OPEN: 0% (case just opened, no work started)
 * - IN_PROGRESS: 40% (actively being worked on)
 * - PENDING_REVIEW: 70% (awaiting review/approval)
 * - ON_HOLD: 25% (paused, minimal progress)
 * - COMPLETED: 100% (fully done)
 * - CLOSED: 100% (archived/closed)
 * 
 * OVERDUE DEFINITION (server time):
 * A case is overdue if: status is NOT completed/closed AND dueDate < now
 */

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  PageHeader,
  StatCard,
  DataTable,
  SearchInput,
  FilterSelect,
  Pagination,
  Badge,
  usePagination,
  useSort,
  type Column,
} from '@/components/admin/shared'
import {
  programmes,
  grievances,
  appeals,
  admins,
  cases,
  formatCurrency,
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
 * Check if a case is overdue (status not completed/closed AND dueDate < now)
 */
function isOverdue(c: Case): boolean {
  if (c.status === 'COMPLETED' || c.status === 'CLOSED') return false
  if (!c.dueDate) return false
  return new Date(c.dueDate) < new Date()
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
 * Segmented progress bar showing distribution across statuses
 */
function SegmentedProgressBar({ statusCounts }: { statusCounts: Record<CaseStatus, number> }) {
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  const segments: { status: CaseStatus; count: number; color: string; label: string }[] = [
    { status: 'COMPLETED', count: statusCounts['COMPLETED'] || 0, color: 'bg-green-500', label: 'Completed' },
    { status: 'CLOSED', count: statusCounts['CLOSED'] || 0, color: 'bg-gray-500', label: 'Closed' },
    { status: 'PENDING_REVIEW', count: statusCounts['PENDING_REVIEW'] || 0, color: 'bg-amber-500', label: 'Pending Review' },
    { status: 'IN_PROGRESS', count: statusCounts['IN_PROGRESS'] || 0, color: 'bg-blue-500', label: 'In Progress' },
    { status: 'ON_HOLD', count: statusCounts['ON_HOLD'] || 0, color: 'bg-orange-400', label: 'On Hold' },
    { status: 'OPEN', count: statusCounts['OPEN'] || 0, color: 'bg-gray-400', label: 'Open' },
  ]

  return (
    <div className="space-y-2">
      <div className="h-4 w-full flex rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
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

export default function AdminOverview() {
  // Filter state for cases table
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // Calculate programme stats
  const totalProgrammes = programmes.length
  const activeProgrammes = programmes.filter(p => p.status === 'ACTIVE').length
  const totalEnrolled = programmes.reduce((sum, p) => sum + p.enrolledCount, 0)
  const totalDisbursed = programmes.reduce((sum, p) => sum + p.benefitsDisbursed, 0)
  
  const openGrievances = grievances.filter(g => g.status === 'OPEN' || g.status === 'IN_PROGRESS').length
  const escalatedGrievances = grievances.filter(g => g.status === 'ESCALATED').length
  
  const pendingAppeals = appeals.filter(a => a.status === 'PENDING' || a.status === 'UNDER_REVIEW').length
  
  const activeAdmins = admins.filter(a => a.status === 'ACTIVE').length

  // ═══════════════════════════════════════════════════════════════════════════
  // CASES PROGRESS SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  const casesStats = useMemo(() => {
    const total = cases.length
    const completed = cases.filter(c => c.status === 'COMPLETED' || c.status === 'CLOSED').length
    const pending = cases.filter(c => c.status !== 'COMPLETED' && c.status !== 'CLOSED').length
    const overdue = cases.filter(c => isOverdue(c)).length

    // Status breakdown for segmented bar
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

    // Overall completion ratio
    const completionRatio = total > 0 ? Math.round((completed / total) * 100) : 0

    return { total, completed, pending, overdue, statusCounts, completionRatio }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // CASES TABLE - FILTERED & PAGINATED
  // ═══════════════════════════════════════════════════════════════════════════

  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      // Search filter
      const matchesSearch = !searchQuery ||
        c.caseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.familyName.toLowerCase().includes(searchQuery.toLowerCase())

      // Status filter
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
  }, [searchQuery, statusFilter])

  const { data: sortedCases, sortColumn, sortDirection, handleSort } = useSort(filteredCases, 'createdAt')
  const pagination = usePagination(sortedCases, 10)

  const casesColumns: Column<Case>[] = [
    {
      key: 'caseNumber',
      label: 'Case #',
      sortable: true,
      render: (c) => <span className="font-mono text-sm">{c.caseNumber}</span>,
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
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (c) => <Badge variant={getCaseStatusVariant(c.status)}>{c.status.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'progress',
      label: 'Progress',
      render: (c) => {
        const progress = getStatusProgress(c.status)
        return (
          <div className="w-24">
            <div className="flex items-center gap-2">
              <ProgressBar value={progress} size="sm" />
              <span className="text-xs text-gray-500">{progress}%</span>
            </div>
          </div>
        )
      },
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (c) => <Badge variant={getPriorityVariant(c.priority)}>{c.priority}</Badge>,
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
            {overdue && <span className="ml-1 text-xs text-red-500">(Overdue)</span>}
          </span>
        )
      },
    },
    {
      key: 'assignedWorkerName',
      label: 'Assigned To',
      render: (c) => (
        <span className="text-sm">
          {c.assignedWorkerName || <span className="text-gray-400 italic">Unassigned</span>}
        </span>
      ),
    },
    {
      key: 'assignedByName',
      label: 'Assigned By',
      render: (c) => <span className="text-sm text-gray-500">{c.assignedByName || '—'}</span>,
    },
    {
      key: 'assignedAt',
      label: 'Assigned At',
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

  const quickLinks = [
    { label: 'Manage Families', icon: 'family_restroom', path: '/admin/families', color: 'bg-blue-500' },
    { label: 'View Programmes', icon: 'verified_user', path: '/admin/programmes', color: 'bg-green-500' },
    { label: 'Handle Grievances', icon: 'error_outline', path: '/admin/grievances', color: 'bg-amber-500' },
    { label: 'Review Appeals', icon: 'gavel', path: '/admin/appeals', color: 'bg-purple-500' },
    { label: 'Case Workers', icon: 'support_agent', path: '/admin/case-workers', color: 'bg-teal-500' },
    { label: 'Audit Logs', icon: 'history', path: '/admin/audit-logs', color: 'bg-gray-500' },
  ]

  const recentActivity = [
    { action: 'New grievance submitted', detail: 'Payment Issue - Johnson Family', time: '10 minutes ago', icon: 'error_outline' },
    { action: 'Appeal approved', detail: 'Emergency payment for Johnson Family', time: '1 hour ago', icon: 'check_circle' },
    { action: 'Family archived', detail: 'Henderson Family - Relocated', time: '3 hours ago', icon: 'archive' },
    { action: 'Permission updated', detail: 'James Cooper - Grievances access', time: '5 hours ago', icon: 'admin_panel_settings' },
    { action: 'Programme updated', detail: 'PATH Cash Transfer enrolment', time: '1 day ago', icon: 'verified_user' },
  ]

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Dashboard Overview"
          subtitle="Welcome back! Here's what's happening today."
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Active Programmes"
            value={activeProgrammes}
            icon="verified_user"
            trend={{ value: 5, positive: true }}
          />
          <StatCard
            label="Total Enrolled"
            value={totalEnrolled.toLocaleString()}
            icon="groups"
            trend={{ value: 8, positive: true }}
          />
          <StatCard
            label="Open Grievances"
            value={openGrievances}
            icon="error_outline"
          />
          <StatCard
            label="Benefits Disbursed"
            value={formatCurrency(totalDisbursed)}
            icon="payments"
            trend={{ value: 12, positive: true }}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CASES PROGRESS SUMMARY */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-8 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Cases Progress</h2>
              <p className="text-sm text-gray-500">Overall case completion and status breakdown</p>
            </div>
            <Link
              to="/admin/case-workers"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View Case Workers
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>

          {/* Stats Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Cases</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{casesStats.total}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <p className="text-sm text-green-600 dark:text-green-400">Completed</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{casesStats.completed}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <p className="text-sm text-blue-600 dark:text-blue-400">Pending</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{casesStats.pending}</p>
            </div>
            <div className={`rounded-lg p-4 ${casesStats.overdue > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
              <p className={`text-sm ${casesStats.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>Overdue</p>
              <p className={`text-2xl font-bold ${casesStats.overdue > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>
                {casesStats.overdue}
              </p>
            </div>
          </div>

          {/* Segmented Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status Distribution</span>
              <span className="text-sm text-gray-500">{casesStats.completionRatio}% complete</span>
            </div>
            <SegmentedProgressBar statusCounts={casesStats.statusCounts} />
          </div>
        </div>

        {/* Alerts Section */}
        {(escalatedGrievances > 0 || pendingAppeals > 0 || casesStats.overdue > 0) && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Attention Required</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {casesStats.overdue > 0 && (
                <button
                  onClick={() => setStatusFilter('OVERDUE')}
                  className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-left"
                >
                  <div className="size-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-red-600 dark:text-red-400">schedule</span>
                  </div>
                  <div>
                    <p className="font-bold text-red-800 dark:text-red-200">
                      {casesStats.overdue} Overdue Case{casesStats.overdue > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400">Past due date</p>
                  </div>
                </button>
              )}
              {escalatedGrievances > 0 && (
                <Link
                  to="/admin/grievances?status=ESCALATED"
                  className="flex items-center gap-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                >
                  <div className="size-12 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-orange-600 dark:text-orange-400">priority_high</span>
                  </div>
                  <div>
                    <p className="font-bold text-orange-800 dark:text-orange-200">
                      {escalatedGrievances} Escalated Grievance{escalatedGrievances > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-orange-600 dark:text-orange-400">Requires immediate attention</p>
                  </div>
                </Link>
              )}
              {pendingAppeals > 0 && (
                <Link
                  to="/admin/appeals?status=PENDING"
                  className="flex items-center gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                >
                  <div className="size-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">gavel</span>
                  </div>
                  <div>
                    <p className="font-bold text-amber-800 dark:text-amber-200">
                      {pendingAppeals} Pending Appeal{pendingAppeals > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-amber-600 dark:text-amber-400">Awaiting review</p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ACTIVE CASES TABLE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-8 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">All Cases</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search by case #, title, or family..."
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
              columns={casesColumns}
              keyExtractor={(c) => c.id}
              emptyMessage="No cases found"
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

        {/* Quick Links and Recent Activity */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Quick Links */}
          <div className="md:col-span-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {quickLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-primary/50 hover:shadow-md transition-all"
                >
                  <div className={`size-12 rounded-full ${link.color} flex items-center justify-center mb-3`}>
                    <span className="material-symbols-outlined text-white">{link.icon}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white text-center">{link.label}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl divide-y divide-gray-200 dark:divide-gray-800">
              {recentActivity.map((activity, index) => (
                <div key={index} className="p-4 flex items-start gap-3">
                  <div className="size-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-sm text-gray-600 dark:text-gray-400">
                      {activity.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.action}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{activity.detail}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* System Stats */}
        <div className="mt-8 grid md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Programmes</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{totalProgrammes}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Active Admins</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{activeAdmins}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Grievances</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{grievances.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Appeals</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{appeals.length}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
