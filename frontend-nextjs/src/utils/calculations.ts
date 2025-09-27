/**
 * Trading Calculations Utility Functions
 * Comprehensive financial and trading calculations for the TurtleTrading platform
 */

// Basic calculation functions
export const calculatePercentageChange = (previous: number, current: number): number => {
  if (previous === 0) return current === 0 ? 0 : Infinity
  if (previous == null || current == null) return NaN
  return ((current - previous) / previous) * 100
}

// Portfolio performance calculations
export interface Position {
  symbol: string
  quantity: number
  currentPrice: number
  costBasis: number
}

export interface Portfolio {
  positions: Position[]
}

export interface PortfolioPerformance {
  totalValue: number
  totalCost: number
  totalGainLoss: number
  totalReturnPercent: number
  positions: {
    symbol: string
    value: number
    cost: number
    gainLoss: number
    returnPercent: number
  }[]
}

export const calculatePortfolioPerformance = (portfolio: Portfolio): PortfolioPerformance => {
  if (!portfolio.positions || portfolio.positions.length === 0) {
    return {
      totalValue: 0,
      totalCost: 0,
      totalGainLoss: 0,
      totalReturnPercent: 0,
      positions: []
    }
  }

  let totalValue = 0
  let totalCost = 0
  const positions = []

  for (const position of portfolio.positions) {
    const value = position.quantity * position.currentPrice
    const cost = position.quantity * position.costBasis
    const gainLoss = value - cost
    const returnPercent = position.costBasis === 0 ? Infinity : (gainLoss / cost) * 100

    totalValue += value
    totalCost += cost

    positions.push({
      symbol: position.symbol,
      value,
      cost,
      gainLoss,
      returnPercent
    })
  }

  const totalGainLoss = totalValue - totalCost
  const totalReturnPercent = totalCost === 0 ? 0 : (totalGainLoss / totalCost) * 100

  return {
    totalValue,
    totalCost,
    totalGainLoss,
    totalReturnPercent,
    positions
  }
}

// Currency formatting
export const formatCurrency = (
  amount: number | null | undefined,
  currency: string = 'USD',
  options: { precision?: number; abbreviate?: boolean } = {}
): string => {
  if (amount == null) return '$0.00'

  const { precision = 2, abbreviate = false } = options

  if (abbreviate && Math.abs(amount) >= 1000) {
    const units = ['', 'K', 'M', 'B', 'T']
    const tier = Math.floor(Math.log10(Math.abs(amount)) / 3)
    const scale = Math.pow(10, tier * 3)
    const scaled = amount / scale
    const unit = units[tier] || ''

    const currencySymbol = getCurrencySymbol(currency)
    const sign = amount < 0 ? '-' : ''
    return `${sign}${currencySymbol}${scaled.toFixed(1)}${unit}`
  }

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  })

  return formatter.format(amount)
}

const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥'
  }
  return symbols[currency] || '$'
}

// Risk metrics calculations
export interface RiskMetrics {
  volatility: number
  beta: number
  sharpeRatio: number
  maxDrawdown: number
}

export const calculateRiskMetrics = (priceData: number[], marketData: number[] = []): RiskMetrics => {
  if (priceData.length < 2) {
    return { volatility: 0, beta: 0, sharpeRatio: 0, maxDrawdown: 0 }
  }

  const returns = calculateReturns(priceData)
  const volatility = calculateVolatility(returns)
  const beta = marketData.length >= 2 ? calculateBeta(returns, calculateReturns(marketData)) : 0
  const sharpeRatio = calculateSharpeRatio(returns, 0.02) // Assuming 2% risk-free rate
  const maxDrawdown = calculateMaxDrawdown(priceData)

  return { volatility, beta, sharpeRatio, maxDrawdown }
}

const calculateReturns = (prices: number[]): number[] => {
  const returns = []
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1])
  }
  return returns
}

const calculateMaxDrawdown = (prices: number[]): number => {
  let maxPrice = prices[0]
  let maxDrawdown = 0

  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > maxPrice) {
      maxPrice = prices[i]
    }
    const drawdown = ((maxPrice - prices[i]) / maxPrice) * 100
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  }

  return maxDrawdown
}

// Technical indicators
export interface TechnicalIndicators {
  rsi: number
  macd: {
    macdLine: number[]
    signalLine: number[]
    histogram: number[]
  }
  bollingerBands: {
    upperBand: number[]
    middleBand: number[]
    lowerBand: number[]
  }
  movingAverages: {
    sma20: number[]
    sma50: number[]
    ema20: number[]
  }
}

export const calculateTechnicalIndicators = (priceData: number[], volumeData: number[]): TechnicalIndicators => {
  const rsi = calculateRSI(priceData)
  const macd = calculateMACD(priceData)
  const bollingerBands = calculateBollingerBands(priceData)
  const movingAverages = {
    sma20: calculateMovingAverage(priceData, 20),
    sma50: calculateMovingAverage(priceData, 50),
    ema20: calculateEMA(priceData, 20)
  }

  return { rsi, macd, bollingerBands, movingAverages }
}

export const calculateRSI = (prices: number[], period: number = 14): number => {
  if (prices.length < period + 1 || period <= 0) return NaN

  const changes = []
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1])
  }

  let avgGain = 0
  let avgLoss = 0

  // Initial average
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else avgLoss += Math.abs(changes[i])
  }
  avgGain /= period
  avgLoss /= period

  // Smoothed averages
  for (let i = period; i < changes.length; i++) {
    const change = changes[i]
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period
      avgLoss = (avgLoss * (period - 1)) / period
    } else {
      avgGain = (avgGain * (period - 1)) / period
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period
    }
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

export const calculateMovingAverage = (prices: number[], period: number): number[] => {
  if (period <= 0 || period > prices.length) return []

  const result = []
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
    result.push(sum / period)
  }
  return result
}

export const calculateEMA = (prices: number[], period: number): number[] => {
  if (period <= 0 || period > prices.length) return []

  const result = []
  const multiplier = 2 / (period + 1)

  // First EMA is SMA
  const sma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  result.push(sma)

  for (let i = period; i < prices.length; i++) {
    const ema = (prices[i] * multiplier) + (result[result.length - 1] * (1 - multiplier))
    result.push(ema)
  }

  return result
}

export const calculateMACD = (prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) => {
  const fastEMA = calculateEMA(prices, fastPeriod)
  const slowEMA = calculateEMA(prices, slowPeriod)

  const macdLine = []
  const startIndex = slowPeriod - fastPeriod

  for (let i = 0; i < fastEMA.length - startIndex; i++) {
    macdLine.push(fastEMA[i + startIndex] - slowEMA[i])
  }

  const signalLine = calculateEMA(macdLine, signalPeriod)
  const histogram = macdLine.slice(-signalLine.length).map((macd, i) => macd - signalLine[i])

  return { macdLine, signalLine, histogram }
}

export const calculateBollingerBands = (prices: number[], period: number = 20, stdDev: number = 2) => {
  const sma = calculateMovingAverage(prices, period)
  const upperBand = []
  const lowerBand = []

  for (let i = 0; i < sma.length; i++) {
    const slice = prices.slice(i, i + period)
    const mean = sma[i]
    const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period
    const standardDeviation = Math.sqrt(variance)

    upperBand.push(mean + (standardDeviation * stdDev))
    lowerBand.push(mean - (standardDeviation * stdDev))
  }

  return {
    upperBand,
    middleBand: sma,
    lowerBand
  }
}

// Position sizing and risk management
export const calculatePositionSize = (
  accountSize: number,
  riskPercent: number,
  entryPrice: number,
  stopLoss: number
): number => {
  if (riskPercent <= 0 || entryPrice <= 0 || stopLoss <= 0) return 0
  if (stopLoss >= entryPrice) return 0 // Invalid stop loss for long position

  const riskAmount = accountSize * (riskPercent / 100)
  const riskPerShare = entryPrice - stopLoss

  if (riskPerShare <= 0) return 0

  return Math.floor(riskAmount / riskPerShare)
}

export const calculateStopLoss = (entryPrice: number, atr: number, direction: 'long' | 'short', multiplier: number = 2): number => {
  if (direction === 'long') {
    return entryPrice - (atr * multiplier)
  } else {
    return entryPrice + (atr * multiplier)
  }
}

export const calculateTargetPrice = (
  entryPrice: number,
  stopLoss: number,
  riskRewardRatio: number,
  direction: 'long' | 'short'
): number => {
  const risk = Math.abs(entryPrice - stopLoss)
  const reward = risk * riskRewardRatio

  if (direction === 'long') {
    return entryPrice + reward
  } else {
    return entryPrice - reward
  }
}

// Number formatting
export const formatNumber = (
  value: number | null | undefined,
  locale: string = 'US',
  options: { precision?: number; abbreviate?: boolean } = {}
): string => {
  if (value == null) return '0'

  const { precision = 2, abbreviate = false } = options

  if (abbreviate && Math.abs(value) >= 1000) {
    const units = ['', 'K', 'M', 'B', 'T']
    const tier = Math.floor(Math.log10(Math.abs(value)) / 3)
    const scale = Math.pow(10, tier * 3)
    const scaled = value / scale
    const unit = units[tier] || ''
    return `${scaled.toFixed(1)}${unit}`
  }

  const localeMap: Record<string, string> = {
    US: 'en-US',
    EU: 'de-DE',
    IN: 'en-IN'
  }

  const formatter = new Intl.NumberFormat(localeMap[locale] || 'en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  })

  return formatter.format(value)
}

// Advanced financial calculations
export const calculateCompoundReturn = (returns: number[]): number => {
  if (returns.length === 0) return 0

  let compound = 1
  for (const ret of returns) {
    compound *= (1 + ret)
  }
  return compound - 1
}

export const calculateSharpeRatio = (returns: number[], riskFreeRate: number = 0.02): number => {
  if (returns.length === 0) return 0

  const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
  const excessReturn = avgReturn - riskFreeRate / 252 // Daily risk-free rate
  const volatility = calculateVolatility(returns)

  return volatility === 0 ? NaN : excessReturn / volatility
}

export const calculateVolatility = (returns: number[]): number => {
  if (returns.length <= 1) return 0

  const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1)

  return Math.sqrt(variance) * Math.sqrt(252) // Annualized volatility
}

export const calculateBeta = (stockReturns: number[], marketReturns: number[]): number => {
  if (stockReturns.length !== marketReturns.length || stockReturns.length === 0) return 0

  const stockMean = stockReturns.reduce((sum, ret) => sum + ret, 0) / stockReturns.length
  const marketMean = marketReturns.reduce((sum, ret) => sum + ret, 0) / marketReturns.length

  let covariance = 0
  let marketVariance = 0

  for (let i = 0; i < stockReturns.length; i++) {
    const stockDiff = stockReturns[i] - stockMean
    const marketDiff = marketReturns[i] - marketMean

    covariance += stockDiff * marketDiff
    marketVariance += marketDiff * marketDiff
  }

  covariance /= (stockReturns.length - 1)
  marketVariance /= (marketReturns.length - 1)

  return marketVariance === 0 ? 0 : covariance / marketVariance
}