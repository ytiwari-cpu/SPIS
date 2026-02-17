// Migration script to clean up old localStorage keys
// Run this once to remove the duplicate 'spis-auth' key

if (typeof window !== 'undefined') {
  // Remove the old manual localStorage key
  const oldKey = 'spis-auth'
  if (localStorage.getItem(oldKey)) {
    console.log('[Migration] Removing old auth key:', oldKey)
    localStorage.removeItem(oldKey)
  }
}

export {}
