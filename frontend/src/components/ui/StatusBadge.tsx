type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'
type BadgeSize = 'sm' | 'md' | 'lg'

interface StatusBadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  children: React.ReactNode
  icon?: string
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  primary: 'bg-primary/10 text-primary dark:bg-primary/20',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-xs px-2 py-1',
  lg: 'text-sm px-3 py-1.5',
}

export function StatusBadge({
  variant = 'default',
  size = 'md',
  children,
  icon,
  className = '',
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {icon && <span className="material-symbols-outlined text-sm">{icon}</span>}
      {children}
    </span>
  )
}

// Helper function to map common status values to badge variants
export function getStatusVariant(status: string): BadgeVariant {
  const statusLower = status.toLowerCase()
  
  if (['verified', 'approved', 'issued', 'resolved', 'active', 'completed'].includes(statusLower)) {
    return 'success'
  }
  if (['pending', 'in_progress', 'under_review', 'processing'].includes(statusLower)) {
    return 'warning'
  }
  if (['rejected', 'failed', 'error', 'closed', 'inactive'].includes(statusLower)) {
    return 'error'
  }
  if (['submitted', 'eligible', 'new'].includes(statusLower)) {
    return 'info'
  }
  return 'default'
}
