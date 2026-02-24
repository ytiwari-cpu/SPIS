/**
 * 403 FORBIDDEN PAGE
 *
 * Shown when an authenticated user tries to access a page they
 * don't have permission for. Does NOT log the user out.
 */

import { Link } from 'react-router-dom'

interface ForbiddenPageProps {
  requiredPermission?: string
}

export default function ForbiddenPage({ requiredPermission }: ForbiddenPageProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="size-20 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-500 text-4xl">lock</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Access Denied
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          You don&apos;t have permission to view this page.
          {requiredPermission && (
            <span className="block mt-1 text-sm text-gray-400 dark:text-gray-500 font-mono">
              Required: {requiredPermission}
            </span>
          )}
        </p>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          If you believe you should have access, contact your system administrator to request the necessary permissions.
        </p>

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
