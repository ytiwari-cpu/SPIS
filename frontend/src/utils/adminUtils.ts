/**
 * ADMIN UTILITIES
 * 
 * Utility functions for admin pages.
 * Extracted from mock data file to be used with real data.
 */

import { useAuthStore } from '@/store/authStore'

// ════════════════════════════════════════════════════════════════════════════
// DATE FORMATTING
// ════════════════════════════════════════════════════════════════════════════

/**
 * Format a date string for display
 */
export function formatDate(
  dateString: string | null | undefined, 
  format: 'short' | 'long' | 'relative' = 'short'
): string {
  if (!dateString) return '—'
  
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return '—'
  
  if (format === 'relative') {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60))
        return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`
      }
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
    }
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
  }
  
  if (format === 'long') {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  
  // short format
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format a date as ISO string for inputs
 */
export function toISODateString(date: Date | string | null): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().split('T')[0]
}

// ════════════════════════════════════════════════════════════════════════════
// CURRENCY FORMATTING
// ════════════════════════════════════════════════════════════════════════════

/**
 * Format a number as currency
 */
export function formatCurrency(amount: number, currency = 'EGP'): string {
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format a number with thousands separators
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

// ════════════════════════════════════════════════════════════════════════════
// PERMISSION CHECKING
// ════════════════════════════════════════════════════════════════════════════

/**
 * Check if current user has a specific permission
 * Uses authStore roles and permissions
 */
export function hasPermission(
  action: 'create' | 'read' | 'update' | 'delete' | 'manage',
  module: string
): boolean {
  const authStore = useAuthStore.getState()
  
  // Admin has all permissions
  if (authStore.hasRole('Admin') || authStore.hasRole('SuperAdmin')) {
    return true
  }
  
  // Map action to permission format
  const actionMap: Record<string, string> = {
    create: 'CREATE',
    read: 'READ',
    update: 'UPDATE',
    delete: 'DELETE',
    manage: 'MANAGE',
  }
  
  const permissionKey = `${module.toUpperCase()}.${actionMap[action]}`
  return authStore.hasPermission(permissionKey)
}

/**
 * Check if current user has a specific role
 */
export function hasRole(role: string): boolean {
  const authStore = useAuthStore.getState()
  return authStore.hasRole(role)
}

/**
 * Check if current user is an admin (any admin level)
 */
export function isAdmin(): boolean {
  const authStore = useAuthStore.getState()
  return authStore.hasRole('Admin') || authStore.hasRole('SuperAdmin')
}

/**
 * Check if current user is a case worker
 */
export function isCaseWorker(): boolean {
  const authStore = useAuthStore.getState()
  return authStore.hasRole('CaseWorker')
}

/**
 * Check if current user is a programme manager
 */
export function isProgrammeManager(): boolean {
  const authStore = useAuthStore.getState()
  return authStore.hasRole('ProgrammeManager')
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORT UTILITIES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Export data to CSV and trigger download
 */
export function exportToCSV<T extends object>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; header: string }[]
): void {
  if (data.length === 0) {
    console.warn('No data to export')
    return
  }
  
  // Determine columns from first row if not provided
  const cols = columns || Object.keys(data[0]).map(key => ({
    key: key as keyof T,
    header: key.toString().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  }))
  
  // Build CSV header
  const header = cols.map(c => `"${c.header}"`).join(',')
  
  // Build CSV rows
  const rows = data.map(row => 
    cols.map(col => {
      const value = row[col.key]
      if (value === null || value === undefined) return '""'
      if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`
      if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`
      return `"${value}"`
    }).join(',')
  )
  
  const csv = [header, ...rows].join('\n')
  
  // Trigger download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export data to JSON and trigger download
 */
export function exportToJSON<T>(data: T, filename: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.json`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ════════════════════════════════════════════════════════════════════════════
// STRING UTILITIES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Truncate a string to a max length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength - 3) + '...'
}

/**
 * Convert a status string to display format
 */
export function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Generate initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
}

// ════════════════════════════════════════════════════════════════════════════
// PAGINATION UTILITIES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Calculate pagination info
 */
export function getPaginationInfo(
  page: number,
  limit: number,
  total: number
): { from: number; to: number; totalPages: number } {
  return {
    from: (page - 1) * limit + 1,
    to: Math.min(page * limit, total),
    totalPages: Math.ceil(total / limit),
  }
}

/**
 * Generate page numbers for pagination UI
 */
export function getPageNumbers(
  currentPage: number,
  totalPages: number,
  maxButtons = 5
): (number | '...')[] {
  if (totalPages <= maxButtons) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  
  const half = Math.floor(maxButtons / 2)
  let start = Math.max(1, currentPage - half)
  const end = Math.min(totalPages, start + maxButtons - 1)
  
  if (end === totalPages) {
    start = Math.max(1, end - maxButtons + 1)
  }
  
  const pages: (number | '...')[] = []
  
  if (start > 1) {
    pages.push(1)
    if (start > 2) pages.push('...')
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('...')
    pages.push(totalPages)
  }
  
  return pages
}
