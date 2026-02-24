/**
 * ACTIVE / ARCHIVED TABS
 *
 * Reusable tab toggle for switching between active and archived record
 * views. Used across every module that supports soft-archive.
 *
 * Controlled component — the parent owns the `isArchived` state.
 */

interface ActiveArchiveTabsProps {
  isArchived: boolean
  onToggle: (archived: boolean) => void
  /** Override the default "Active" label. */
  activeLabel?: string
  /** Override the default "Archived" label. */
  archivedLabel?: string
  className?: string
}

export default function ActiveArchiveTabs({
  isArchived,
  onToggle,
  activeLabel = 'Active',
  archivedLabel = 'Archived',
  className = '',
}: ActiveArchiveTabsProps) {
  return (
    <div className={`flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm ${className}`}>
      <button
        onClick={() => onToggle(false)}
        className={`px-4 py-2 font-medium transition-colors ${
          !isArchived
            ? 'bg-primary text-white'
            : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
      >
        {activeLabel}
      </button>
      <button
        onClick={() => onToggle(true)}
        className={`px-4 py-2 font-medium border-l border-gray-200 dark:border-gray-700 transition-colors flex items-center gap-1 ${
          isArchived
            ? 'bg-primary text-white'
            : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
      >
        <span className="material-symbols-outlined text-base">archive</span>
        {archivedLabel}
      </button>
    </div>
  )
}
