interface LoaderProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  text?: string
}

const sizeClasses = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
}

export function Loader({ size = 'md', className = '', text }: LoaderProps) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <span className={`material-symbols-outlined animate-spin ${sizeClasses[size]} text-primary`}>
        progress_activity
      </span>
      {text && <span className="text-sm text-gray-500 dark:text-gray-400">{text}</span>}
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader size="lg" text="Loading..." />
    </div>
  )
}

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm z-50">
      <div className="flex flex-col items-center gap-4">
        <Loader size="lg" />
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  )
}
