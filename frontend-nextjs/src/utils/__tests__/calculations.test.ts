/**
 * Trading Calculations Unit Tests
 * 100% coverage for utility calculation functions
 */

import {
  calculatePercentageChange,
  calculatePortfolioPerformance,
  formatCurrency,
  calculateRiskMetrics,
  calculateTechnicalIndicators,
  calculatePositionSize,
  calculateStopLoss,
  calculateTargetPrice,
  formatNumber,
  calculateCompoundReturn,
  calculateSharpeRatio,
  calculateVolatility,
  calculateBeta,
  calculateMovingAverage,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands
} from '../calculations'

describe('Trading Calculations', () => {
  describe('Percentage Change Calculations', () => {
    it('should calculate percentage changes accurately', () => {
      expect(calculatePercentageChange(100, 110)).toBe(10)
      expect(calculatePercentageChange(100, 90)).toBe(-10)
      expect(calculatePercentageChange(50, 75)).toBe(50)
      expect(calculatePercentageChange(200, 150)).toBe(-25)
    })

    it('should handle zero previous value', () => {
      expect(calculatePercentageChange(0, 100)).toBe(Infinity)
      expect(calculatePercentageChange(0, 0)).toBe(0)
    })

    it('should handle negative values', () => {
      expect(calculatePercentageChange(-100, -90)).toBe(10)
      expect(calculatePercentageChange(-100, -110)).toBe(-10)
      expect(calculatePercentageChange(100, -100)).toBe(-200)
    })

    it('should handle decimal precision', () => {
      const result = calculatePercentageChange(100.123, 105.456)
      expect(result).toBeCloseTo(5.326, 2)
    })
  })

  describe('Portfolio Performance Calculations', () => {
    it('should compute portfolio performance metrics', () => {
      const portfolio = {
        positions: [
          { symbol: 'AAPL', quantity: 100, currentPrice: 150, costBasis: 140 },
          { symbol: 'MSFT', quantity: 50, currentPrice: 300, costBasis: 280 },
          { symbol: 'GOOGL', quantity: 25, currentPrice: 2500, costBasis: 2600 }
        ]
      }

      const performance = calculatePortfolioPerformance(portfolio)

      expect(performance.totalValue).toBe(92500) // 15000 + 15000 + 62500
      expect(performance.totalCost).toBe(91500) // 14000 + 14000 + 65000
      expect(performance.totalGainLoss).toBe(1000)
      expect(performance.totalReturnPercent).toBeCloseTo(1.09, 2)
    })

    it('should handle empty portfolio', () => {
      const portfolio = { positions: [] }
      const performance = calculatePortfolioPerformance(portfolio)

      expect(performance.totalValue).toBe(0)
      expect(performance.totalCost).toBe(0)
      expect(performance.totalGainLoss).toBe(0)
      expect(performance.totalReturnPercent).toBe(0)
    })

    it('should calculate individual position metrics', () => {
      const portfolio = {
        positions: [
          { symbol: 'AAPL', quantity: 100, currentPrice: 150, costBasis: 140 }
        ]
      }

      const performance = calculatePortfolioPerformance(portfolio)

      expect(performance.positions[0].value).toBe(15000)
      expect(performance.positions[0].cost).toBe(14000)
      expect(performance.positions[0].gainLoss).toBe(1000)
      expect(performance.positions[0].returnPercent).toBeCloseTo(7.14, 2)
    })

    it('should handle zero cost basis', () => {
      const portfolio = {
        positions: [
          { symbol: 'AAPL', quantity: 100, currentPrice: 150, costBasis: 0 }
        ]
      }

      const performance = calculatePortfolioPerformance(portfolio)
      expect(performance.positions[0].returnPercent).toBe(Infinity)
    })
  })

  describe('Currency Formatting', () => {
    it('should handle currency formatting with precision', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56')
      expect(formatCurrency(1000000.789)).toBe('$1,000,000.79')
      expect(formatCurrency(0.123)).toBe('$0.12')
      expect(formatCurrency(-500.75)).toBe('-$500.75')
    })

    it('should handle different currencies', () => {
      expect(formatCurrency(1234.56, 'EUR')).toBe('€1,234.56')
      expect(formatCurrency(1234.56, 'GBP')).toBe('£1,234.56')
      expect(formatCurrency(1234.56, 'JPY')).toBe('¥1,235')
    })

    it('should handle large numbers with abbreviations', () => {
      expect(formatCurrency(1500000, 'USD', { abbreviate: true })).toBe('$1.5M')
      expect(formatCurrency(2500000000, 'USD', { abbreviate: true })).toBe('$2.5B')
      expect(formatCurrency(1200000000000, 'USD', { abbreviate: true })).toBe('$1.2T')
    })

    it('should handle custom precision', () => {
      expect(formatCurrency(1234.5678, 'USD', { precision: 4 })).toBe('$1,234.5678')
      expect(formatCurrency(1234.5678, 'USD', { precision: 0 })).toBe('$1,235')
    })
  })

  describe('Risk Metrics Calculations', () => {
    it('should calculate risk metrics (volatility, beta)', () => {
      const priceData = [100, 105, 102, 108, 104, 110, 107, 112, 108, 115]
      const marketData = [1000, 1050, 1020, 1080, 1040, 1100, 1070, 1120, 1080, 1150]

      const riskMetrics = calculateRiskMetrics(priceData, marketData)

      expect(riskMetrics.volatility).toBeGreaterThan(0)
      expect(riskMetrics.beta).toBeGreaterThan(0)
      expect(riskMetrics.sharpeRatio).toBeDefined()
      expect(riskMetrics.maxDrawdown).toBeGreaterThan(0)
    })

    it('should handle insufficient data for risk calculations', () => {
      const priceData = [100, 105]
      const marketData = [1000, 1050]

      const riskMetrics = calculateRiskMetrics(priceData, marketData)

      expect(riskMetrics.volatility).toBe(0)
      expect(riskMetrics.beta).toBe(0)
      expect(riskMetrics.sharpeRatio).toBe(0)
    })

    it('should calculate maximum drawdown correctly', () => {
      const priceData = [100, 110, 105, 115, 90, 100, 95, 120]
      const riskMetrics = calculateRiskMetrics(priceData, [])

      // Max drawdown should be from 115 to 90 = -21.74%
      expect(riskMetrics.maxDrawdown).toBeCloseTo(21.74, 1)
    })
  })

  describe('Technical Indicator Calculations', () => {
    it('should compute technical indicator values', () => {
      const priceData = [100, 102, 104, 103, 105, 107, 106, 108, 110, 109]
      const volumeData = [1000, 1100, 1200, 1150, 1250, 1300, 1275, 1350, 1400, 1375]

      const indicators = calculateTechnicalIndicators(priceData, volumeData)

      expect(indicators.rsi).toBeGreaterThan(0)
      expect(indicators.rsi).toBeLessThan(100)
      expect(indicators.macd).toBeDefined()
      expect(indicators.bollingerBands).toBeDefined()
      expect(indicators.movingAverages).toBeDefined()
    })

    it('should handle edge cases (zero values, null data)', () => {
      const priceData = [0, 0, 0, 100, 100]
      const volumeData = [0, 0, 0, 1000, 1000]

      const indicators = calculateTechnicalIndicators(priceData, volumeData)

      expect(indicators.rsi).toBeGreaterThanOrEqual(0)
      expect(indicators.rsi).toBeLessThanOrEqual(100)
    })

    it('should calculate RSI correctly', () => {
      const prices = [44, 44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.85, 46.08, 45.89,
                     46.03, 46.83, 46.69, 46.45, 46.59, 46.3, 46.28, 46.28, 46.00, 46.03]

      const rsi = calculateRSI(prices, 14)

      // RSI should be between 0 and 100
      expect(rsi).toBeGreaterThan(0)
      expect(rsi).toBeLessThan(100)
      expect(rsi).toBeCloseTo(70.46, 1) // Expected RSI value
    })

    it('should calculate moving average correctly', () => {
      const prices = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28]
      const ma5 = calculateMovingAverage(prices, 5)

      expect(ma5).toHaveLength(6) // 10 - 5 + 1
      expect(ma5[0]).toBe(14) // (10+12+14+16+18)/5
      expect(ma5[ma5.length - 1]).toBe(24) // (20+22+24+26+28)/5
    })

    it('should calculate MACD correctly', () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i + Math.sin(i) * 5)
      const macd = calculateMACD(prices)

      expect(macd).toBeDefined()
      expect(macd.macdLine).toBeDefined()
      expect(macd.signalLine).toBeDefined()
      expect(macd.histogram).toBeDefined()
    })

    it('should calculate Bollinger Bands correctly', () => {
      const prices = [20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 38, 36, 34, 32, 30, 28, 26, 24, 22]
      const bb = calculateBollingerBands(prices, 10, 2)

      expect(bb).toBeDefined()
      expect(bb.upperBand).toBeDefined()
      expect(bb.middleBand).toBeDefined()
      expect(bb.lowerBand).toBeDefined()
      expect(bb.upperBand[0]).toBeGreaterThan(bb.middleBand[0])
      expect(bb.middleBand[0]).toBeGreaterThan(bb.lowerBand[0])
    })
  })

  describe('Position Sizing and Risk Management', () => {
    it('should calculate position size based on risk tolerance', () => {
      const accountSize = 100000
      const riskPercent = 2 // 2% risk per trade
      const entryPrice = 100
      const stopLoss = 95

      const positionSize = calculatePositionSize(accountSize, riskPercent, entryPrice, stopLoss)

      // Risk amount = $2000, Risk per share = $5, Position size = 400 shares
      expect(positionSize).toBe(400)
    })

    it('should handle zero risk scenarios', () => {
      const positionSize = calculatePositionSize(100000, 0, 100, 95)
      expect(positionSize).toBe(0)
    })

    it('should handle invalid stop loss (above entry)', () => {
      const positionSize = calculatePositionSize(100000, 2, 100, 105)
      expect(positionSize).toBe(0)
    })

    it('should calculate stop loss levels', () => {
      const entryPrice = 100
      const atrValue = 2.5

      const stopLoss = calculateStopLoss(entryPrice, atrValue, 'long')
      expect(stopLoss).toBe(95) // 100 - (2 * 2.5)

      const stopLossShort = calculateStopLoss(entryPrice, atrValue, 'short')
      expect(stopLossShort).toBe(105) // 100 + (2 * 2.5)
    })

    it('should calculate target prices with risk-reward ratios', () => {
      const entryPrice = 100
      const stopLoss = 95
      const riskRewardRatio = 2

      const targetPrice = calculateTargetPrice(entryPrice, stopLoss, riskRewardRatio, 'long')
      expect(targetPrice).toBe(110) // 100 + (5 * 2)

      const targetPriceShort = calculateTargetPrice(entryPrice, 105, riskRewardRatio, 'short')
      expect(targetPriceShort).toBe(90) // 100 - (5 * 2)
    })
  })

  describe('Number Formatting and Display', () => {
    it('should format numbers for different locales', () => {
      expect(formatNumber(1234567.89, 'US')).toBe('1,234,567.89')
      expect(formatNumber(1234567.89, 'EU')).toBe('1.234.567,89')
      expect(formatNumber(1234567.89, 'IN')).toBe('12,34,567.89')
    })

    it('should handle scientific notation for very large/small numbers', () => {
      expect(formatNumber(1e10)).toBe('10,000,000,000')
      expect(formatNumber(1e-6, 'US', { precision: 8 })).toBe('0.00000100')
    })

    it('should abbreviate large numbers appropriately', () => {
      expect(formatNumber(1500, 'US', { abbreviate: true })).toBe('1.5K')
      expect(formatNumber(2500000, 'US', { abbreviate: true })).toBe('2.5M')
      expect(formatNumber(1200000000, 'US', { abbreviate: true })).toBe('1.2B')
    })
  })

  describe('Advanced Financial Calculations', () => {
    it('should calculate compound return correctly', () => {
      const returns = [0.1, 0.05, -0.02, 0.08, 0.03] // 10%, 5%, -2%, 8%, 3%
      const compoundReturn = calculateCompoundReturn(returns)

      // (1.1 * 1.05 * 0.98 * 1.08 * 1.03) - 1 ≈ 0.2544
      expect(compoundReturn).toBeCloseTo(0.2544, 3)
    })

    it('should calculate Sharpe ratio', () => {
      const returns = [0.1, 0.05, -0.02, 0.08, 0.03]
      const riskFreeRate = 0.02

      const sharpeRatio = calculateSharpeRatio(returns, riskFreeRate)

      expect(sharpeRatio).toBeGreaterThan(0)
      expect(sharpeRatio).toBeFinite()
    })

    it('should calculate volatility (standard deviation)', () => {
      const returns = [0.1, 0.05, -0.02, 0.08, 0.03]
      const volatility = calculateVolatility(returns)

      expect(volatility).toBeGreaterThan(0)
      expect(volatility).toBeLessThan(1)
    })

    it('should calculate beta relative to market', () => {
      const stockReturns = [0.1, 0.05, -0.02, 0.08, 0.03]
      const marketReturns = [0.08, 0.04, -0.01, 0.06, 0.02]

      const beta = calculateBeta(stockReturns, marketReturns)

      expect(beta).toBeGreaterThan(0)
      expect(beta).toBeFinite()
    })

    it('should handle edge cases in financial calculations', () => {
      // Empty arrays
      expect(calculateCompoundReturn([])).toBe(0)
      expect(calculateVolatility([])).toBe(0)
      expect(calculateSharpeRatio([], 0.02)).toBe(0)

      // Single value
      expect(calculateCompoundReturn([0.1])).toBe(0.1)
      expect(calculateVolatility([0.1])).toBe(0)

      // All zeros
      expect(calculateCompoundReturn([0, 0, 0])).toBe(0)
      expect(calculateVolatility([0, 0, 0])).toBe(0)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle null and undefined inputs', () => {
      expect(calculatePercentageChange(null as any, 100)).toBeNaN()
      expect(calculatePercentageChange(100, undefined as any)).toBeNaN()
      expect(formatCurrency(null as any)).toBe('$0.00')
      expect(formatNumber(undefined as any)).toBe('0')
    })

    it('should handle division by zero scenarios', () => {
      expect(calculatePercentageChange(0, 100)).toBe(Infinity)
      expect(calculateSharpeRatio([0.1, 0.1, 0.1], 0.1)).toBeNaN() // Zero std dev
    })

    it('should handle array bounds in technical indicators', () => {
      const shortArray = [100, 101]
      const indicators = calculateTechnicalIndicators(shortArray, [1000, 1001])

      // Should handle gracefully without throwing errors
      expect(indicators).toBeDefined()
    })

    it('should validate input parameters', () => {
      // Negative period for moving average
      expect(calculateMovingAverage([1, 2, 3, 4, 5], -1)).toEqual([])

      // Period longer than data
      expect(calculateMovingAverage([1, 2, 3], 5)).toEqual([])

      // Invalid RSI period
      expect(calculateRSI([1, 2, 3], 0)).toBeNaN()
    })

    it('should handle extreme values without overflow', () => {
      const largeNumbers = [1e15, 1e15 + 1, 1e15 + 2]
      const result = calculateMovingAverage(largeNumbers, 2)

      expect(result).toBeDefined()
      expect(result.every(val => isFinite(val))).toBe(true)
    })
  })
})