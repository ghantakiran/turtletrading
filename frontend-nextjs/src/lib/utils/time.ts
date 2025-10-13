/**
 * Time Utility Functions
 * Format relative time for display
 */

export function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Never'

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 10) {
    return 'Just now'
  } else if (diffSec < 60) {
    return `${diffSec}s ago`
  } else if (diffSec < 3600) {
    const minutes = Math.floor(diffSec / 60)
    return `${minutes}m ago`
  } else if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600)
    return `${hours}h ago`
  } else {
    const days = Math.floor(diffSec / 86400)
    return `${days}d ago`
  }
}
