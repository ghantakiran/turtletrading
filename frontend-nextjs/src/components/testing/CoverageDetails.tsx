/**
 * Coverage Details Component
 * Displays file-level coverage data in a sortable table
 */

'use client'

import { FileCoverage, CoverageDetail } from '@/types/testing'
import { useState, useMemo } from 'react'
import CoverageFilters from './CoverageFilters'

interface CoverageDetailsProps {
  fileCoverage: FileCoverage[]
  threshold?: number
}

type SortField = 'path' | 'statements' | 'branches' | 'functions' | 'lines'
type SortDirection = 'asc' | 'desc'
type ThresholdFilter = 'all' | 'low' | 'medium' | 'high'

export default function CoverageDetails({ fileCoverage, threshold = 70 }: CoverageDetailsProps) {
  const [sortField, setSortField] = useState<SortField>('statements')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [searchQuery, setSearchQuery] = useState('')
  const [thresholdFilter, setThresholdFilter] = useState<ThresholdFilter>('all')

  if (fileCoverage.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          File Coverage Details
        </h2>
        <div className="text-center py-8 text-gray-600 dark:text-gray-400">
          No coverage data available
        </div>
      </div>
    )
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Filter files based on search and threshold
  const filteredFiles = useMemo(() => {
    let filtered = fileCoverage

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(file =>
        file.path.toLowerCase().includes(query)
      )
    }

    // Apply threshold filter
    if (thresholdFilter !== 'all') {
      filtered = filtered.filter(file => {
        const pct = file.statements.pct
        switch (thresholdFilter) {
          case 'low':
            return pct < 60
          case 'medium':
            return pct >= 60 && pct < 80
          case 'high':
            return pct >= 80
          default:
            return true
        }
      })
    }

    return filtered
  }, [fileCoverage, searchQuery, thresholdFilter])

  const sortedFiles = useMemo(() => {
    return [...filteredFiles].sort((a, b) => {
      let aValue: number | string
      let bValue: number | string

      if (sortField === 'path') {
        aValue = a.path
        bValue = b.path
      } else {
        aValue = a[sortField].pct
        bValue = b[sortField].pct
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number)
    })
  }, [filteredFiles, sortField, sortDirection])

  const getCoverageColor = (pct: number): string => {
    if (pct >= 80) return 'text-green-600 dark:text-green-400'
    if (pct >= 60) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getCoverageDataAttr = (pct: number): { [key: string]: string } => {
    if (pct >= 80) return { 'data-coverage-high': 'true' }
    if (pct >= 60) return { 'data-coverage-medium': 'true' }
    return { 'data-coverage-low': 'true' }
  }

  const formatCoverage = (detail: CoverageDetail): string => {
    return `${detail.covered}/${detail.total} (${detail.pct.toFixed(1)}%)`
  }

  const truncatePath = (path: string, maxLength: number = 50): string => {
    if (path.length <= maxLength) return path

    const parts = path.split('/')
    const filename = parts[parts.length - 1]

    if (filename.length >= maxLength - 10) {
      return `.../${filename.substring(0, maxLength - 13)}...`
    }

    return `.../${filename}`
  }

  const isLowCoverage = (pct: number): boolean => pct < threshold

  const handleClearFilters = () => {
    setSearchQuery('')
    setThresholdFilter('all')
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            File Coverage Details
          </h2>
        </div>

        {/* Filters */}
        <CoverageFilters
          searchQuery={searchQuery}
          threshold={thresholdFilter}
          onSearchChange={setSearchQuery}
          onThresholdChange={setThresholdFilter}
          onClearFilters={handleClearFilters}
          fileCount={filteredFiles.length}
          totalCount={fileCoverage.length}
        />

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            <span className="text-gray-600 dark:text-gray-400">High (&ge;80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
            <span className="text-gray-600 dark:text-gray-400">Medium (60-79%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full"></span>
            <span className="text-gray-600 dark:text-gray-400">Low (&lt;60%)</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort('path')}
              >
                File Path
                {sortField === 'path' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort('statements')}
              >
                Statements
                {sortField === 'statements' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort('branches')}
              >
                Branches
                {sortField === 'branches' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort('functions')}
              >
                Functions
                {sortField === 'functions' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort('lines')}
              >
                Lines
                {sortField === 'lines' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedFiles.map((file, index) => {
              const rowClass = isLowCoverage(file.statements.pct)
                ? 'bg-red-50 dark:bg-red-900/20 warning alert highlight'
                : ''

              return (
                <tr key={index} className={rowClass}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <span title={file.path}>{truncatePath(file.path)}</span>
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getCoverageColor(file.statements.pct)}`}
                    {...getCoverageDataAttr(file.statements.pct)}
                  >
                    {formatCoverage(file.statements)}
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getCoverageColor(file.branches.pct)}`}
                  >
                    {formatCoverage(file.branches)}
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getCoverageColor(file.functions.pct)}`}
                  >
                    {formatCoverage(file.functions)}
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getCoverageColor(file.lines.pct)}`}
                  >
                    {formatCoverage(file.lines)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
