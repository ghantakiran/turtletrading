/**
 * Coverage Filters Component
 * Search and filter controls for coverage data
 */

'use client'

interface CoverageFiltersProps {
  searchQuery: string
  threshold: 'all' | 'low' | 'medium' | 'high'
  onSearchChange: (query: string) => void
  onThresholdChange: (threshold: 'all' | 'low' | 'medium' | 'high') => void
  onClearFilters: () => void
  fileCount?: number
  totalCount?: number
}

export default function CoverageFilters({
  searchQuery,
  threshold,
  onSearchChange,
  onThresholdChange,
  onClearFilters,
  fileCount,
  totalCount,
}: CoverageFiltersProps) {
  const hasActiveFilters = searchQuery !== '' || threshold !== 'all'

  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6">
      {/* Search Input */}
      <div className="flex-1">
        <label htmlFor="coverage-search" className="sr-only">
          Search files
        </label>
        <input
          id="coverage-search"
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search files by path..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Search files"
        />
      </div>

      {/* Threshold Filter */}
      <div className="flex-shrink-0">
        <label htmlFor="coverage-threshold" className="sr-only">
          Filter by coverage threshold
        </label>
        <select
          id="coverage-threshold"
          value={threshold}
          onChange={(e) => onThresholdChange(e.target.value as any)}
          className="w-full md:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Filter by coverage threshold"
        >
          <option value="all">All Files</option>
          <option value="low">Low Coverage (&lt;60%)</option>
          <option value="medium">Medium Coverage (60-79%)</option>
          <option value="high">High Coverage (≥80%)</option>
        </select>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="flex-shrink-0 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          aria-label="Clear all filters"
        >
          Clear Filters
        </button>
      )}

      {/* File Count Display */}
      {fileCount !== undefined && totalCount !== undefined && (
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
          <span>
            {fileCount} of {totalCount} files
          </span>
        </div>
      )}
    </div>
  )
}
