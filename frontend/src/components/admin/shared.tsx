/**
 * Shared Admin Components
 * Reusable UI components for Super Admin dashboard pages
 */

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import {
  type ImportColumn,
  type ParsedImportResult,
  parseAndValidateExcel,
  downloadImportTemplate,
  downloadErrorReport,
} from '@/utils/excelUtils'

// ════════════════════════════════════════════════════════════════════════════
// DATA TABLE
// ════════════════════════════════════════════════════════════════════════════

export interface Column<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  render?: (item: T) => ReactNode
  width?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (item: T) => string
  onRowClick?: (item: T) => void
  emptyMessage?: string
  loading?: boolean
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
  onSort?: (column: string) => void
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data found',
  loading = false,
  sortColumn,
  sortDirection,
  onSort,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-12 bg-gray-200 dark:bg-gray-800 rounded mb-2" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-gray-900 rounded mb-2" />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
        <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-700 mb-3 block">
          inbox
        </span>
        <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full min-w-[800px]">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap ${
                  column.sortable ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-200' : ''
                } ${column.key === 'actions' ? 'sticky right-0 bg-gray-50 dark:bg-gray-900' : ''}`}
                style={column.width ? { width: column.width } : undefined}
                onClick={() => column.sortable && onSort?.(String(column.key))}
              >
                <div className="flex items-center gap-1">
                  {column.label}
                  {column.sortable && sortColumn === column.key && (
                    <span className="material-symbols-outlined text-sm">
                      {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-950">
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              className={`${
                onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900' : ''
              } transition-colors`}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((column) => (
                <td
                  key={String(column.key)}
                  className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 ${
                    column.key === 'actions' ? 'whitespace-nowrap sticky right-0 bg-white dark:bg-gray-950' : ''
                  }`}
                >
                  {column.render
                    ? column.render(item)
                    : String((item as Record<string, unknown>)[column.key as string] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PAGINATION
// ════════════════════════════════════════════════════════════════════════════

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 rounded-b-lg">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Showing <span className="font-medium">{startItem}</span> to{' '}
        <span className="font-medium">{endItem}</span> of{' '}
        <span className="font-medium">{totalItems}</span> results
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number
            if (totalPages <= 5) {
              pageNum = i + 1
            } else if (currentPage <= 3) {
              pageNum = i + 1
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i
            } else {
              pageNum = currentPage - 2 + i
            }
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                  currentPage === pageNum
                    ? 'bg-primary text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {pageNum}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SEARCH INPUT
// ════════════════════════════════════════════════════════════════════════════

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchInput({ value, onChange, placeholder = 'Search...' }: SearchInputProps) {
  return (
    <div className="relative">
      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        search
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// FILTER SELECT
// ════════════════════════════════════════════════════════════════════════════

interface FilterSelectProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder = 'All',
  className = '',
}: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent ${className}`}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL
// ════════════════════════════════════════════════════════════════════════════

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: ReactNode
  /** If false, clicking outside the modal won't close it */
  closeOnClickOutside?: boolean
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  closeOnClickOutside = true,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={closeOnClickOutside ? onClose : undefined} />
      <div
        className={`relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full ${sizeClasses[size]} mx-4 max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// DRAWER
// ════════════════════════════════════════════════════════════════════════════

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

export function Drawer({ isOpen, onClose, title, children, footer }: DrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-xl bg-white dark:bg-gray-900 shadow-xl z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// CONFIRM DIALOG
// ════════════════════════════════════════════════════════════════════════════

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  requireReason?: boolean
  reason?: string
  onReasonChange?: (reason: string) => void
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  requireReason = false,
  reason = '',
  onReasonChange,
}: ConfirmDialogProps) {
  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-amber-600 hover:bg-amber-700',
    info: 'bg-blue-600 hover:bg-blue-700',
  }

  const canConfirm = !requireReason || reason.trim().length > 0

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm" closeOnClickOutside={false}>
      <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
      {requireReason && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Reason (required)
          </label>
          <textarea
            value={reason}
            onChange={(e) => onReasonChange?.(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Please provide a reason..."
          />
        </div>
      )}
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          className={`px-4 py-2 text-sm font-medium rounded-lg text-white ${variantStyles[variant]} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE HEADER
// ════════════════════════════════════════════════════════════════════════════

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  breadcrumb?: { label: string; href?: string }[]
}

export function PageHeader({ title, subtitle, actions, breadcrumb }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
          {breadcrumb.map((item, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <span className="material-symbols-outlined text-xs">chevron_right</span>}
              {item.href ? (
                <a href={item.href} className="hover:text-primary">
                  {item.label}
                </a>
              ) : (
                <span>{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {subtitle && (
            <p className="text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════════════════════════════════

interface Tab {
  id: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex border-b border-gray-200 dark:border-gray-800 mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ACTION BUTTON
// ════════════════════════════════════════════════════════════════════════════

interface ActionButtonProps {
  onClick: () => void
  icon?: string
  label: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function ActionButton({
  onClick,
  icon,
  label,
  variant = 'secondary',
  size = 'md',
  disabled = false,
}: ActionButtonProps) {
  const variantStyles = {
    primary: 'bg-primary text-white hover:bg-primary/90',
    secondary: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
    danger: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50',
    ghost: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
  }

  const sizeStyles = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors ${variantStyles[variant]} ${sizeStyles[size]} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {icon && <span className="material-symbols-outlined text-base">{icon}</span>}
      {label}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// BADGE
// ════════════════════════════════════════════════════════════════════════════

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
}

const badgeStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  primary: 'bg-primary/10 text-primary',
}

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase rounded-full ${badgeStyles[variant]}`}
    >
      {children}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STAT CARD
// ════════════════════════════════════════════════════════════════════════════

interface StatCardProps {
  label: string
  value: string | number
  icon: string
  trend?: { value: number; positive: boolean }
  onClick?: () => void
}

export function StatCard({ label, value, icon, trend, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 ${
        onClick ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary">{icon}</span>
        </div>
      </div>
      {trend && (
        <p
          className={`text-xs mt-2 ${
            trend.positive ? 'text-green-600' : 'text-red-600'
          }`}
        >
          <span className="material-symbols-outlined text-xs align-middle">
            {trend.positive ? 'trending_up' : 'trending_down'}
          </span>{' '}
          {trend.positive ? '+' : ''}
          {trend.value}% from last month
        </p>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// USEPAGINATION HOOK
// ════════════════════════════════════════════════════════════════════════════

export function usePagination<T>(data: T[], itemsPerPage: number = 10) {
  const [currentPage, setCurrentPage] = useState(1)

  const totalItems = data.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)

  const paginatedData = data.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages))
  }

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1)
  }, [data.length])

  return {
    data: paginatedData,
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    goToPage,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// USESORT HOOK
// ════════════════════════════════════════════════════════════════════════════

export function useSort<T>(data: T[], defaultColumn?: keyof T) {
  const [sortColumn, setSortColumn] = useState<string | undefined>(defaultColumn as string)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedData = [...data].sort((a, b) => {
    if (!sortColumn) return 0

    const aVal = (a as Record<string, unknown>)[sortColumn]
    const bVal = (b as Record<string, unknown>)[sortColumn]

    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1

    let comparison = 0
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal)
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal
    } else {
      comparison = String(aVal).localeCompare(String(bVal))
    }

    return sortDirection === 'asc' ? comparison : -comparison
  })

  return {
    data: sortedData,
    sortColumn,
    sortDirection,
    handleSort,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORT DROPDOWN
// ════════════════════════════════════════════════════════════════════════════

export { type ImportColumn }

interface ExportDropdownProps {
  onExportCSV: () => void
  onExportExcel: () => void
  /** If provided, an Import option is added to the dropdown */
  onImport?: () => void
  disabled?: boolean
}

export function ExportDropdown({ onExportCSV, onExportExcel, onImport, disabled = false }: ExportDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-base">import_export</span>
        {onImport ? 'Import / Export' : 'Export'}
        <span className="material-symbols-outlined text-base">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[185px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 overflow-hidden">
          {onImport && (
            <>
              <button
                onClick={() => { onImport(); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="material-symbols-outlined text-base text-blue-500">download</span>
                Import from Excel
              </button>
              <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
            </>
          )}
          <button
            onClick={() => { onExportCSV(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="material-symbols-outlined text-base text-gray-400">upload</span>
            Export as CSV
          </button>
          <button
            onClick={() => { onExportExcel(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="material-symbols-outlined text-base text-green-600">table_view</span>
            Export as Excel
          </button>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// IMPORT MODAL
// ════════════════════════════════════════════════════════════════════════════

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called with the valid (fully-validated) rows after the user confirms */
  onImport: (rows: Record<string, string>[]) => void
  title: string
  /** Column schema for validation and template generation */
  columns: ImportColumn[]
  /** Base filename used for template download and error report */
  templateFilename: string
}

export function ImportModal({
  isOpen,
  onClose,
  onImport,
  title,
  columns,
  templateFilename,
}: ImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState('')
  const [result, setResult] = useState<ParsedImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep('upload')
    setFileName('')
    setFileError('')
    setResult(null)
    setImporting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleClose = () => { reset(); onClose() }

  const processFile = (file: File) => {
    setFileError('')
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setFileError('Only .xlsx and .xls files are supported.')
      return
    }
    setFileName(file.name)
    parseAndValidateExcel(file, columns, (parsed) => {
      if (parsed.totalRows === 0) {
        setFileError('The file appears to be empty or could not be read.')
        return
      }
      setResult(parsed)
      setStep('preview')
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleConfirmImport = () => {
    if (!result) return
    setImporting(true)
    onImport(result.valid)
    reset()
    onClose()
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="lg" closeOnClickOutside={false}>
      {step === 'upload' ? (
        <div className="space-y-5">
          {/* Template download banner */}
          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Step 1 — Download the template</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Fill in the template file, then upload it below</p>
            </div>
            <button
              onClick={() => downloadImportTemplate(templateFilename, columns)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-base">download</span>
              Download Template
            </button>
          </div>

          {/* Column legend */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Column reference</p>
            <div className="flex flex-wrap gap-1.5">
              {columns.map(col => (
                <span
                  key={col.key}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                    col.required
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {col.required && <span className="text-red-500 font-bold">*</span>}
                  {col.label}
                  {col.type === 'enum' && col.options && (
                    <span className="text-gray-400 dark:text-gray-500 ml-0.5">
                      ({col.options.join('/')})
                    </span>
                  )}
                  {col.type === 'number' && col.min !== undefined && col.max !== undefined && (
                    <span className="text-gray-400 dark:text-gray-500 ml-0.5">{col.min}–{col.max}</span>
                  )}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5"><span className="text-red-500 font-bold">*</span> Required fields</p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                : 'border-gray-300 dark:border-gray-700 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-3 block">
              {isDragging ? 'file_download' : 'upload_file'}
            </span>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isDragging ? 'Drop your file here' : 'Drag & drop your Excel file here'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">or click to browse — supports .xlsx and .xls</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
          />

          {fileError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-base">error</span>
              <p className="text-sm text-red-700 dark:text-red-300">{fileError}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{result?.valid.length ?? 0}</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Valid rows</p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{result?.invalid.length ?? 0}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Invalid rows</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate" title={fileName}>{fileName}</p>
              <button onClick={() => { reset() }} className="text-xs text-primary hover:underline mt-0.5">Change file</button>
            </div>
          </div>

          {/* Invalid rows preview */}
          {(result?.invalid.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  Rows with errors ({result!.invalid.length})
                </p>
                <button
                  onClick={() => downloadErrorReport(templateFilename, columns, result!.invalid)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Download error report
                </button>
              </div>
              <div className="max-h-52 overflow-auto border border-red-200 dark:border-red-800 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-red-50 dark:bg-red-900/20 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-red-700 dark:text-red-300 whitespace-nowrap">Row #</th>
                      {columns.slice(0, 3).map(c => (
                        <th key={c.key} className="px-3 py-2 text-left font-semibold text-red-700 dark:text-red-300 whitespace-nowrap">{c.label}</th>
                      ))}
                      <th className="px-3 py-2 text-left font-semibold text-red-700 dark:text-red-300">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result!.invalid.map(({ row, data, errors }) => (
                      <tr key={row} className="border-t border-red-100 dark:border-red-900/30 hover:bg-red-50/50 dark:hover:bg-red-900/10">
                        <td className="px-3 py-2 font-mono text-red-600 dark:text-red-400">{row}</td>
                        {columns.slice(0, 3).map(c => (
                          <td key={c.key} className={`px-3 py-2 ${
                            errors[c.key] ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {data[c.key] || <span className="text-gray-400">—</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-red-600 dark:text-red-400">
                          {Object.values(errors).join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Valid rows preview (first 5) */}
          {(result?.valid.length ?? 0) > 0 && (
            <div>
              <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">
                Valid rows preview (first 5 of {result!.valid.length})
              </p>
              <div className="max-h-40 overflow-auto border border-green-200 dark:border-green-800 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-green-50 dark:bg-green-900/20 sticky top-0">
                    <tr>
                      {columns.map(c => (
                        <th key={c.key} className="px-3 py-2 text-left font-semibold text-green-700 dark:text-green-300 whitespace-nowrap">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result!.valid.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-green-100 dark:border-green-900/30">
                        {columns.map(c => (
                          <td key={c.key} className="px-3 py-2 text-gray-700 dark:text-gray-300">
                            {row[c.key] || <span className="text-gray-400">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(result?.valid.length ?? 0) === 0 && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
              <span className="material-symbols-outlined text-3xl text-red-400 mb-2 block">error_outline</span>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">No valid rows found</p>
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">Fix the errors in the file and re-upload.</p>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={() => reset()}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              ← Upload different file
            </button>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={(result?.valid.length ?? 0) === 0 || importing}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">upload</span>
                {importing ? 'Importing…' : `Import ${result?.valid.length ?? 0} row${(result?.valid.length ?? 0) !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
