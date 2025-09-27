'use client'

interface RefreshButtonProps {
  onClick: () => void
  isRefreshing: boolean
  lastUpdated?: string
  className?: string
  showLastUpdated?: boolean
}

export function RefreshButton({
  onClick,
  isRefreshing,
  lastUpdated,
  className = '',
  showLastUpdated = true
}: RefreshButtonProps) {
  const formatLastUpdated = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) {
      return 'Just now'
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {showLastUpdated && lastUpdated && (
        <span className="text-xs text-gray-500 hidden sm:block">
          Updated {formatLastUpdated(lastUpdated)}
        </span>
      )}
      <button
        onClick={onClick}
        disabled={isRefreshing}
        className={`
          inline-flex items-center justify-center p-2 rounded-md transition-colors
          ${isRefreshing
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }
        `}
        title={isRefreshing ? 'Refreshing...' : 'Refresh data'}
      >
        <svg
          className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {isRefreshing && (
          <span className="ml-2 text-xs text-gray-500 hidden sm:block">
            Refreshing...
          </span>
        )}
      </button>
    </div>
  )
}