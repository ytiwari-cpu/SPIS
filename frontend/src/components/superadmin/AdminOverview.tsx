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

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts'
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
  grievances,
  appeals,
  admins,
  cases,
  formatCurrency,
  formatDate,
  type Case,
  type CaseStatus,
} from '@/mock/superAdminMockData'
import { getProgrammes } from '@/services/programmeApi'
import type { Programme } from '@/types/programme'

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

  const segments = [
    { name: 'Completed', value: statusCounts['COMPLETED'] || 0, color: '#22c55e' }, // bg-green-500
    { name: 'Closed', value: statusCounts['CLOSED'] || 0, color: '#6b7280' }, // bg-gray-500
    { name: 'Pending Review', value: statusCounts['PENDING_REVIEW'] || 0, color: '#f59e0b' }, // bg-amber-500
    { name: 'In Progress', value: statusCounts['IN_PROGRESS'] || 0, color: '#3b82f6' }, // bg-blue-500
    { name: 'On Hold', value: statusCounts['ON_HOLD'] || 0, color: '#fb923c' }, // bg-orange-400
    { name: 'Open', value: statusCounts['OPEN'] || 0, color: '#9ca3af' }, // bg-gray-400
  ].filter(s => s.value > 0)

  return (
    <div className="h-64 mt-4 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={segments}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {segments.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <RechartsTooltip
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function AdminOverviewContent() {
  // Filter state for cases table
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // Real programme data from API
  const [realProgrammes, setRealProgrammes] = useState<Programme[]>([])
  const [programmesLoading, setProgrammesLoading] = useState(true)

  useEffect(() => {
    getProgrammes()
      .then(data => setRealProgrammes(data))
      .catch(() => setRealProgrammes([]))
      .finally(() => setProgrammesLoading(false))
  }, [])

  // Calculate programme stats from real data
  const totalProgrammes = realProgrammes.length
  const activeProgrammes = realProgrammes.filter(p => p.active_flag).length
  const totalEnrolled = realProgrammes.reduce((sum, p) => sum + (p.programme_rules?.length ?? 0), 0)
  const totalBudget = realProgrammes.reduce((sum, p) => sum + (p.programme_payment_settings?.total_budget_allocated ?? 0), 0)

  const caseWorkerChartData = useMemo(() => {
    return [
      { name: 'Sarah Mitchell', Assigned: 45, Completed: 38 },
      { name: 'James Cooper', Assigned: 52, Completed: 31 },
      { name: 'Maria Santos', Assigned: 38, Completed: 29 },
      { name: 'David Brown', Assigned: 24, Completed: 22 },
      { name: 'Jennifer White', Assigned: 18, Completed: 18 },
    ]
  }, [])

  const budgetChartData = useMemo(() => {
    // Determine if any real programme actually has budget data attached.
    const hasBudgetData = realProgrammes.some(p => p.programme_payment_settings?.total_budget_allocated)

    if (realProgrammes.length > 0 && hasBudgetData) {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
      return realProgrammes
        .filter(p => p.programme_payment_settings?.total_budget_allocated)
        .sort((a, b) => (b.programme_payment_settings?.total_budget_allocated || 0) - (a.programme_payment_settings?.total_budget_allocated || 0))
        .slice(0, 5)
        .map((p, index) => ({
          name: p.programme_name || 'Unnamed',
          value: p.programme_payment_settings!.total_budget_allocated,
          color: colors[index % colors.length]
        }))
    }

    // Fallback Dummy Data - Used if realProgrammes has no budget data or if API fails
    return [
      { name: 'PATH Cash Transfer', value: 45000000, color: '#3b82f6' }, // blue
      { name: 'NHF Health Coverage', value: 62000000, color: '#10b981' }, // green
      { name: 'School Feeding', value: 28000000, color: '#f59e0b' }, // amber
      { name: 'Education Grant', value: 22000000, color: '#8b5cf6' }, // purple
      { name: 'STEP Employment', value: 15000000, color: '#ec4899' }, // pink
    ]
  }, [realProgrammes])

  const grievancesChartData = useMemo(() => {
    return [
      { name: 'Payment Issue', count: 12 },
      { name: 'Eligibility', count: 8 },
      { name: 'Service', count: 5 },
      { name: 'Staff Conduct', count: 3 },
      { name: 'Data Correction', count: 4 },
    ]
  }, [])

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
    { label: 'Programme Admin', icon: 'verified_user', path: '/programme-admin', color: 'bg-green-500' },
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
            value={programmesLoading ? '...' : formatCurrency(totalBudget)}
            icon="payments"
            trend={{ value: 12, positive: true }}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CHARTS GRID */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">

          {/* CASES PROGRESS SUMMARY */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col">
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

            {/* Segmented Progress Bar -> PieChart */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status Distribution</span>
                <span className="text-sm text-gray-500">{casesStats.completionRatio}% complete</span>
              </div>
              <SegmentedProgressBar statusCounts={casesStats.statusCounts} />
            </div>
          </div>

          {/* CASE WORKER PRODUCTIVITY CHART */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Top Case Workers</h2>
                <p className="text-sm text-gray-500">Case resolution performance</p>
              </div>
            </div>

            <div className="flex-1 w-full h-80 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={caseWorkerChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                  />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="Assigned" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* BUDGET DISTRIBUTION CHART */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col h-full min-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Budget Distribution</h2>
                <p className="text-sm text-gray-500">Allocation across top programmes</p>
              </div>
            </div>

            <div className="w-full h-80 min-h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={budgetChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {budgetChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => formatCurrency(Number(value))}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRIEVANCES BY CATEGORY CHART */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col h-full min-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Grievances by Category</h2>
                <p className="text-sm text-gray-500">Volume of complaints by type</p>
              </div>
            </div>

            <div className="w-full h-80 min-h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grievancesChartData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} width={90} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="count" name="Grievances" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
