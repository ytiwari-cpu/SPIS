import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function Settings() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const settingsGroups = [
    {
      title: 'Account',
      items: [
        { icon: 'person', label: 'Edit Profile', path: '/profile' },
        { icon: 'lock', label: 'Change Password', action: () => alert('Password change coming soon') },
        { icon: 'security', label: 'Two-Factor Authentication', action: () => alert('2FA coming soon') },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { icon: 'language', label: 'Language', value: 'English' },
        { icon: 'notifications', label: 'Notifications', value: 'Enabled' },
        { icon: 'dark_mode', label: 'Dark Mode', value: 'System' },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: 'help', label: 'Help Center', action: () => alert('Help center coming soon') },
        { icon: 'chat', label: 'Contact Support', action: () => alert('Support coming soon') },
        { icon: 'description', label: 'Terms of Service' },
        { icon: 'privacy_tip', label: 'Privacy Policy' },
      ],
    },
  ]

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </header>

        {/* Settings Groups */}
        <div className="space-y-6">
          {settingsGroups.map((group, groupIdx) => (
            <section key={groupIdx}>
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
                {group.title}
              </h2>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                {group.items.map((item, itemIdx) => (
                  <button
                    key={itemIdx}
                    onClick={() => {
                      if ('path' in item && item.path) navigate(item.path)
                      else if ('action' in item && item.action) item.action()
                    }}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-gray-400">{item.icon}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {'value' in item && item.value && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">{item.value}</span>
                      )}
                      <span className="material-symbols-outlined text-gray-400 text-lg">chevron_right</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Logout Button */}
        <div className="mt-8">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            <span className="material-symbols-outlined">logout</span>
            Sign Out
          </button>
        </div>

        {/* App Info */}
        <div className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
          <p>SPIS Citizen Portal v1.0.0</p>
          <p className="mt-1">© 2026 Social Protection Information System</p>
        </div>
      </div>
    </div>
  )
}
