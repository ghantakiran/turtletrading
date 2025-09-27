'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PortfolioData } from '@/lib/api/portfolio-data'
import { useUIStore } from '@/stores/uiStore'

interface PortfolioActionsProps {
  data: PortfolioData
  onRebalance?: () => void
  onExport?: (format: string) => void
  onRefresh?: () => void
}

export function PortfolioActions({ data, onRebalance, onExport, onRefresh }: PortfolioActionsProps) {
  const [showRebalanceDialog, setShowRebalanceDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [rebalanceStrategy, setRebalanceStrategy] = useState('equal-weight')
  const [exportFormat, setExportFormat] = useState('csv')
  const { showNotification } = useUIStore()

  const handleRebalance = () => {
    setShowRebalanceDialog(false)
    showNotification('Portfolio rebalancing initiated', 'success')
    onRebalance?.()
  }

  const handleExport = () => {
    setShowExportDialog(false)
    showNotification(`Exporting portfolio data as ${exportFormat.toUpperCase()}`, 'info')
    onExport?.(exportFormat)
  }

  const handleRefresh = () => {
    showNotification('Refreshing portfolio data', 'info')
    onRefresh?.()
  }

  return (
    <>
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          Export
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowRebalanceDialog(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          Rebalance
        </Button>
        <Button size="sm" onClick={handleRefresh}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </Button>
      </div>

      {/* Rebalance Dialog */}
      <Dialog open={showRebalanceDialog} onOpenChange={setShowRebalanceDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rebalance Portfolio</DialogTitle>
            <DialogDescription>
              Choose a rebalancing strategy to optimize your portfolio allocation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="strategy" className="text-right">
                Strategy
              </Label>
              <Select value={rebalanceStrategy} onValueChange={setRebalanceStrategy}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal-weight">Equal Weight</SelectItem>
                  <SelectItem value="market-cap">Market Cap Weighted</SelectItem>
                  <SelectItem value="risk-parity">Risk Parity</SelectItem>
                  <SelectItem value="momentum">Momentum Based</SelectItem>
                  <SelectItem value="custom">Custom Allocation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {rebalanceStrategy && (
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                <h4 className="font-medium mb-2">
                  {rebalanceStrategy === 'equal-weight' && 'Equal Weight Strategy'}
                  {rebalanceStrategy === 'market-cap' && 'Market Cap Weighted'}
                  {rebalanceStrategy === 'risk-parity' && 'Risk Parity Strategy'}
                  {rebalanceStrategy === 'momentum' && 'Momentum Based Strategy'}
                  {rebalanceStrategy === 'custom' && 'Custom Allocation'}
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {rebalanceStrategy === 'equal-weight' && 'Allocate equal weight to all positions'}
                  {rebalanceStrategy === 'market-cap' && 'Weight positions by market capitalization'}
                  {rebalanceStrategy === 'risk-parity' && 'Allocate based on risk contribution'}
                  {rebalanceStrategy === 'momentum' && 'Weight based on price momentum'}
                  {rebalanceStrategy === 'custom' && 'Use your custom allocation targets'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleRebalance}>
              Rebalance Portfolio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Export Portfolio</DialogTitle>
            <DialogDescription>
              Export your portfolio data in various formats for analysis or record keeping.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="format" className="text-right">
                Format
              </Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Excel Compatible)</SelectItem>
                  <SelectItem value="json">JSON (Developer Friendly)</SelectItem>
                  <SelectItem value="pdf">PDF Report</SelectItem>
                  <SelectItem value="xlsx">Excel Workbook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Export Contents</h4>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <li>• Current holdings and positions</li>
                <li>• Profit & Loss summary</li>
                <li>• Portfolio allocation breakdown</li>
                <li>• Performance metrics</li>
                <li>• Recent transaction history</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleExport}>
              Export Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Portfolio filters component
export function PortfolioFilters() {
  const [dateRange, setDateRange] = useState('1m')
  const [sortBy, setSortBy] = useState('value')
  const [filterBy, setFilterBy] = useState('all')

  return (
    <div className="flex items-center space-x-4 p-4 bg-white dark:bg-slate-800 rounded-lg border">
      <div className="flex items-center space-x-2">
        <Label htmlFor="date-range">Period:</Label>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1d">1D</SelectItem>
            <SelectItem value="1w">1W</SelectItem>
            <SelectItem value="1m">1M</SelectItem>
            <SelectItem value="3m">3M</SelectItem>
            <SelectItem value="1y">1Y</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center space-x-2">
        <Label htmlFor="sort-by">Sort:</Label>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="value">Value</SelectItem>
            <SelectItem value="gain">Gain/Loss</SelectItem>
            <SelectItem value="symbol">Symbol</SelectItem>
            <SelectItem value="weight">Weight</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center space-x-2">
        <Label htmlFor="filter-by">Filter:</Label>
        <Select value={filterBy} onValueChange={setFilterBy}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="gainers">Gainers</SelectItem>
            <SelectItem value="losers">Losers</SelectItem>
            <SelectItem value="large">Large Cap</SelectItem>
            <SelectItem value="small">Small Cap</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
