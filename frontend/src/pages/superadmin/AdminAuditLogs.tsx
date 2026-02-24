/**
 * ADMIN AUDIT LOGS PAGE
 * 
 * Immutable log table with filters by user, module, date range.
 * Uses real API - no mock data.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterSelect,
  Pagination,
  ActionButton,
  Badge,
  type Column,
} from '@/components/admin/shared'
import { getAuditLogs, type AuditLogEntry, type AuditLogFilters } from '@/services/rbacApi'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'

function getActionVariant(action: string): BadgeVariant {
  const upperAction = action.toUpperCase()
  if (upperAction.includes('CREATED') || upperAction.includes('CREATE')) return 'success'
  if (upperAction.includes('UPDATED') || upperAction.includes('UPDATE')) return 'info'
  if (upperAction.includes('DELETED') || upperAction.includes('DELETE')) return 'error'
  if (upperAction.includes('ARCHIVED') || upperAction.includes('ARCHIVE')) return 'warning'
  if (upperAction.includes('LOGIN')) return 'primary'
  if (upperAction.includes('LOGOUT')) return 'default'
  return 'default'
}

function getStatusVariant(statusCode: number): BadgeVariant {
  if (statusCode >= 200 && statusCode < 300) return 'success'
  if (statusCode >= 400 && statusCode < 500) return 'warning'
  if (statusCode >= 500) return 'error'
  return 'default'
}

function getMethodVariant(method: string): BadgeVariant {
  switch (method.toUpperCase()) {
    case 'GET': return 'info'
    case 'POST': return 'success'
    case 'PUT':
    case 'PATCH': return 'warning'
    case 'DELETE': return 'error'
    default: return 'default'
  }
}

export default function AdminAuditLogs() {
  // Pure permission-based checks from JWT - no role names!
  const { hasPermission } = useAuthStore()
  
  const canExport = hasPermission('ADMIN.AUDITLOGS.EXPORT')

  // Data state
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const filters: AuditLogFilters = {
        page: pagination.page,
        limit: pagination.limit,
      }
      
      if (searchQuery) filters.action = searchQuery
      if (methodFilter) filters.method = methodFilter
      if (resourceFilter) filters.resource_type = resourceFilter
      if (statusFilter) filters.status_code = parseInt(statusFilter, 10)
      if (dateFrom) filters.start_date = dateFrom
      if (dateTo) filters.end_date = dateTo
      
      const result = await getAuditLogs(filters)
      setLogs(result.data)
      setPagination(prev => ({
        ...prev,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, searchQuery, methodFilter, resourceFilter, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Table columns
  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'created_at',
      label: 'Timestamp',
      sortable: true,
      width: '180px',
      render: (log) => (
        <span className="text-sm font-mono text-gray-500">
          {new Date(log.created_at).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      ),
    },
    {
      key: 'actor_email',
      label: 'Actor',
      render: (log) => (
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <span className="material-symbols-outlined text-xs text-gray-500">person</span>
          </div>
          <span className="font-medium text-sm">{log.actor_email || log.actor_sub || 'System'}</span>
        </div>
      ),
    },
    {
      key: 'method',
      label: 'Method',
      render: (log) => <Badge variant={getMethodVariant(log.method)}>{log.method}</Badge>,
    },
    {
      key: 'action',
      label: 'Action',
      render: (log) => <Badge variant={getActionVariant(log.action)}>{log.action}</Badge>,
    },
    {
      key: 'path',
      label: 'Path',
      render: (log) => (
        <span className="font-mono text-xs truncate max-w-[200px] block" title={log.path}>
          {log.path}
        </span>
      ),
    },
    {
      key: 'resource_type',
      label: 'Resource',
      render: (log) => log.resource_type ? (
        <span className="text-sm">{log.resource_type}</span>
      ) : (
        <span className="text-gray-400">—</span>
      ),
    },
    {
      key: 'status_code',
      label: 'Status',
      render: (log) => (
        <Badge variant={getStatusVariant(log.status_code)}>{log.status_code}</Badge>
      ),
    },
    {
      key: 'duration_ms',
      label: 'Duration',
      render: (log) => log.duration_ms ? (
        <span className="font-mono text-xs text-gray-500">{log.duration_ms}ms</span>
      ) : (
        <span className="text-gray-400">—</span>
      ),
    },
    {
      key: 'ip_address',
      label: 'IP',
      render: (log) => log.ip_address ? (
        <span className="font-mono text-xs text-gray-500">{log.ip_address}</span>
      ) : (
        <span className="text-gray-400">—</span>
      ),
    },
  ]

  // Handlers
  const handleClearFilters = () => {
    setSearchQuery('')
    setMethodFilter('')
    setResourceFilter('')
    setStatusFilter('')
    setDateFrom('')
    setDateTo('')
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }

  const handleExport = () => {
    // Export current filtered data to CSV
    if (!logs.length) return
    
    const headers = ['Timestamp', 'Actor', 'Method', 'Action', 'Path', 'Resource', 'Status', 'Duration (ms)', 'IP']
    const rows = logs.map(log => [
      new Date(log.created_at).toISOString(),
      log.actor_email || log.actor_sub || 'System',
      log.method,
      log.action,
      log.path,
      log.resource_type || '',
      String(log.status_code),
      String(log.duration_ms || ''),
      log.ip_address || '',
    ])
    
    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const methodOptions = [
    { value: 'GET', label: 'GET' },
    { value: 'POST', label: 'POST' },
    { value: 'PUT', label: 'PUT' },
    { value: 'PATCH', label: 'PATCH' },
    { value: 'DELETE', label: 'DELETE' },
  ]

  const statusOptions = [
    { value: '200', label: '2xx Success' },
    { value: '400', label: '4xx Client Error' },
    { value: '500', label: '5xx Server Error' },
  ]

  const hasFilters = searchQuery || methodFilter || resourceFilter || statusFilter || dateFrom || dateTo

  if (error) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <PageHeader title="Audit Logs" subtitle="View system activity and changes" />
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={fetchLogs}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Audit Logs"
          subtitle="View system activity and changes"
          actions={
            canExport && (
              <ActionButton
                onClick={handleExport}
                icon="download"
                label="Export CSV"
                variant="secondary"
                disabled={!logs.length}
              />
            )
          }
        />

        {/* Info Banner */}
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">
              info
            </span>
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-200">
                Immutable Audit Trail
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                All system activities are automatically logged and cannot be modified or deleted.
                This ensures complete accountability and compliance with audit requirements.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by action..."
              />
            </div>
            <FilterSelect
              value={methodFilter}
              onChange={setMethodFilter}
              options={methodOptions}
              placeholder="All Methods"
            />
            <FilterSelect
              value={resourceFilter}
              onChange={setResourceFilter}
              options={[
                { value: 'family', label: 'Family' },
                { value: 'member', label: 'Member' },
                { value: 'programme', label: 'Programme' },
                { value: 'role', label: 'Role' },
                { value: 'user', label: 'User' },
              ]}
              placeholder="All Resources"
            />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              placeholder="All Status"
            />
            <div className="flex items-center gap-2">
              {hasFilters && (
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Date Range */}
          <div className="flex flex-col md:flex-row gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 dark:text-gray-400">From:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 dark:text-gray-400">To:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {loading ? 'Loading...' : `${pagination.total} log entries found`}
          </p>
        </div>

        {/* Table */}
        <DataTable
          data={logs}
          columns={columns}
          keyExtractor={(log) => log.id}
          emptyMessage={loading ? 'Loading audit logs...' : 'No audit logs found'}
        />

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  )
}
