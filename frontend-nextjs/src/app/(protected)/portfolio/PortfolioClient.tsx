'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { PortfolioData } from '@/lib/api/portfolio-data'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useMarketStore } from '@/stores/marketStore'
import { useUIStore } from '@/stores/uiStore'
import { PortfolioActions } from '@/components/portfolio/PortfolioActions'

interface PortfolioClientProps {
  initialData: PortfolioData
}

export function PortfolioClient({ initialData }: PortfolioClientProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [portfolioData, setPortfolioData] = useState(initialData)
  const [priceFlash, setPriceFlash] = useState<Record<string, 'green' | 'red' | null>>({})
  
  const { stockPrices, isConnected } = useMarketStore()
  const { showNotification, theme } = useUIStore()

  // Update portfolio with real-time price changes
  useEffect(() => {
    if (!portfolioData.holdings || !stockPrices) return

    const updatedHoldings = portfolioData.holdings.map(holding => {
      const currentPrice = stockPrices[holding.symbol]?.price
      if (currentPrice && currentPrice !== holding.currentPrice) {
        const newTotalValue = holding.quantity * currentPrice
        const newUnrealizedGain = newTotalValue - (holding.quantity * holding.averageCost)
        const newUnrealizedGainPercent = (newUnrealizedGain / (holding.quantity * holding.averageCost)) * 100

        // Flash animation for price changes
        const priceChange = currentPrice > holding.currentPrice ? 'green' : 'red'
        setPriceFlash(prev => ({ ...prev, [holding.symbol]: priceChange }))
        setTimeout(() => {
          setPriceFlash(prev => ({ ...prev, [holding.symbol]: null }))
        }, 1000)

        return {
          ...holding,
          currentPrice,
          totalValue: newTotalValue,
          unrealizedGain: newUnrealizedGain,
          unrealizedGainPercent: newUnrealizedGainPercent
        }
      }
      return holding
    })

    // Update portfolio data with new holdings
    setPortfolioData(prev => ({
      ...prev,
      holdings: updatedHoldings
    }))
  }, [stockPrices, portfolioData.holdings])

  return (
    <div className="space-y-6">
      {/* Real-time connection status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`h-2 w-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isConnected ? 'Live Data' : 'Offline'}
          </span>
        </div>
        
        {/* Portfolio actions */}
        <PortfolioActions
          data={portfolioData}
          onRebalance={() => console.log('Rebalancing portfolio...')}
          onExport={(format) => console.log(`Exporting as ${format}...`)}
          onRefresh={() => console.log('Refreshing data...')}
        />
      </div>

      {/* Portfolio tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="allocation">Allocation</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <OverviewTab 
            data={portfolioData} 
            priceFlash={priceFlash}
            isConnected={isConnected}
          />
        </TabsContent>

        {/* Allocation Tab */}
        <TabsContent value="allocation" className="space-y-6">
          <AllocationTab 
            data={portfolioData}
          />
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-6">
          <TransactionsTab 
            data={portfolioData}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Overview Tab Component
function OverviewTab({ data, priceFlash, isConnected }: {
  data: PortfolioData
  priceFlash: Record<string, 'green' | 'red' | null>
  isConnected: boolean
}) {
  if (!data.pnl || !data.holdings) {
    return <div className="text-center py-8">Portfolio data unavailable</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Portfolio Summary */}
      <div className="lg:col-span-2 space-y-6">
        {/* P&L Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                ${data.pnl.totalValue.toLocaleString()}
              </div>
              <div className={`text-sm flex items-center ${
                data.pnl.dayChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                <svg className={`w-4 h-4 mr-1 ${
                  data.pnl.dayChange >= 0 ? 'rotate-0' : 'rotate-180'
                }`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                ${Math.abs(data.pnl.dayChange).toLocaleString()} ({data.pnl.dayChangePercent.toFixed(2)}%)
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Unrealized P&L
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                data.pnl.unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                ${data.pnl.unrealizedGain.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {data.pnl.unrealizedGainPercent.toFixed(2)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Realized P&L
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                data.pnl.realizedGain >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                ${data.pnl.realizedGain.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {data.pnl.realizedGainPercent.toFixed(2)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Return
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                data.pnl.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                ${data.pnl.totalReturn.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {data.pnl.totalReturnPercent.toFixed(2)}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Holdings Table */}
        <Card>
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
            <CardDescription>Your current portfolio positions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.holdings.map((holding) => (
                <motion.div
                  key={holding.symbol}
                  className={`p-4 rounded-lg border transition-colors ${
                    priceFlash[holding.symbol] === 'green' ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800' :
                    priceFlash[holding.symbol] === 'red' ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800' :
                    'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                  }`}
                  animate={{
                    scale: priceFlash[holding.symbol] ? 1.02 : 1,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold">{holding.symbol}</span>
                        <Badge variant="outline">
                          {holding.quantity} shares
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Avg Cost: ${holding.averageCost.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        ${holding.totalValue.toLocaleString()}
                      </div>
                      <div className={`text-sm ${
                        holding.unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {holding.unrealizedGain >= 0 ? '+' : ''}${holding.unrealizedGain.toFixed(2)} ({holding.unrealizedGainPercent.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Portfolio Metrics */}
        {data.metrics && (
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm">
                  <span>Beta</span>
                  <span className="font-medium">{data.metrics.beta.toFixed(2)}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span>Sharpe Ratio</span>
                  <span className="font-medium">{data.metrics.sharpeRatio.toFixed(2)}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span>Volatility</span>
                  <span className="font-medium">{data.metrics.volatility.toFixed(1)}%</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span>Max Drawdown</span>
                  <span className="font-medium text-red-600">{data.metrics.maxDrawdown.toFixed(1)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Position
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Performance Analysis
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Risk Analysis
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Allocation Tab Component
function AllocationTab({ data }: { data: PortfolioData }) {
  if (!data.allocation) {
    return <div className="text-center py-8">Allocation data unavailable</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Sector Allocation */}
      <Card>
        <CardHeader>
          <CardTitle>Sector Allocation</CardTitle>
          <CardDescription>Portfolio breakdown by sector</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.allocation.sectors.map((sector) => (
            <div key={sector.sector} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{sector.sector}</span>
                <span>{sector.percentage.toFixed(1)}%</span>
              </div>
              <Progress value={sector.percentage} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Asset Type Allocation */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Types</CardTitle>
          <CardDescription>Portfolio breakdown by asset type</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.allocation.assetTypes.map((type) => (
            <div key={type.type} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{type.type}</span>
                <span>{type.percentage.toFixed(1)}%</span>
              </div>
              <Progress value={type.percentage} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Top Holdings */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Top Holdings</CardTitle>
          <CardDescription>Largest positions by portfolio weight</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.allocation.topHoldings.map((holding, index) => (
              <div key={holding.symbol} className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                    {index + 1}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="font-medium">{holding.symbol}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    ${holding.value.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{holding.percentage.toFixed(1)}%</div>
                  <Progress value={holding.percentage} className="h-1 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Transactions Tab Component
function TransactionsTab({ data }: { data: PortfolioData }) {
  if (!data.transactions) {
    return <div className="text-center py-8">Transaction data unavailable</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>Your trading history and activity</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.transactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  transaction.type === 'BUY' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  {transaction.type === 'BUY' ? '+' : '-'}
                </div>
                <div>
                  <div className="font-medium">{transaction.symbol}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {transaction.type} {transaction.quantity} shares @ ${transaction.price.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">
                  ${transaction.totalAmount.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {new Date(transaction.date).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
