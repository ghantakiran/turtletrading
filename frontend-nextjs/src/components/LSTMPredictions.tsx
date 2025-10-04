'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart
} from 'recharts'
import { Brain, TrendingUp, TrendingDown, Calendar, Target, Loader2, AlertCircle } from 'lucide-react'

interface PredictionPoint {
  date: string
  predicted_price: number
  lower_bound: number
  upper_bound: number
}

interface LSTMPredictionData {
  symbol: string
  current_price: number
  predictions: PredictionPoint[]
  horizon_days: number
  model_accuracy: number
  directional_accuracy: number
  confidence: number
  last_updated: string
}

interface LSTMPredictionsProps {
  symbol: string
  initialDays?: number
}

export default function LSTMPredictions({ symbol, initialDays = 30 }: LSTMPredictionsProps) {
  const [predictions, setPredictions] = useState<LSTMPredictionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDays, setSelectedDays] = useState(initialDays)

  const dayOptions = [7, 14, 30, 60, 90]

  useEffect(() => {
    fetchPredictions()
  }, [symbol, selectedDays])

  const fetchPredictions = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`http://localhost:8000/api/v1/lstm/${symbol}/predict?days=${selectedDays}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch predictions: ${response.statusText}`)
      }

      const data = await response.json()
      setPredictions(data)
    } catch (err) {
      console.error('Error fetching LSTM predictions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load predictions')
    } finally {
      setLoading(false)
    }
  }

  // Format chart data
  const chartData = predictions?.predictions.map((pred, index) => ({
    day: index + 1,
    date: new Date(pred.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    price: pred.predicted_price,
    lower: pred.lower_bound,
    upper: pred.upper_bound,
    current: index === 0 ? predictions.current_price : null
  })) || []

  // Add current price as day 0
  if (predictions && chartData.length > 0) {
    chartData.unshift({
      day: 0,
      date: 'Today',
      price: predictions.current_price,
      lower: predictions.current_price,
      upper: predictions.current_price,
      current: predictions.current_price
    })
  }

  // Calculate prediction trend
  const priceTrend = predictions ?
    ((chartData[chartData.length - 1]?.price - predictions.current_price) / predictions.current_price) * 100 : 0
  const isBullish = priceTrend > 0

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Price Predictions
          </CardTitle>
          <CardDescription>LSTM neural network forecasts</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Price Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
          <Button onClick={fetchPredictions} className="mt-4" variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!predictions) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>AI Price Predictions</CardTitle>
          </div>
          <Badge variant={isBullish ? "default" : "destructive"} className="gap-1">
            {isBullish ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {priceTrend > 0 ? '+' : ''}{priceTrend.toFixed(2)}%
          </Badge>
        </div>
        <CardDescription>
          LSTM neural network forecasts for the next {predictions.horizon_days} days
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Time Horizon Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Forecast Period:</span>
          {dayOptions.map((days) => (
            <Button
              key={days}
              size="sm"
              variant={selectedDays === days ? "default" : "outline"}
              onClick={() => setSelectedDays(days)}
            >
              {days} days
            </Button>
          ))}
        </div>

        {/* Model Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Current Price</p>
            <p className="text-2xl font-bold">${predictions.current_price.toFixed(2)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Predicted ({selectedDays}d)</p>
            <p className="text-2xl font-bold">
              ${chartData[chartData.length - 1]?.price.toFixed(2)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Model Accuracy</p>
            <p className="text-2xl font-bold">{(predictions.model_accuracy * 100).toFixed(1)}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Confidence</p>
            <p className="text-2xl font-bold">{(predictions.confidence * 100).toFixed(1)}%</p>
          </div>
        </div>

        {/* Price Prediction Chart */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--muted))" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="hsl(var(--muted))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
              />
              <Legend />

              {/* Confidence interval */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="none"
                fill="url(#colorConfidence)"
                name="Upper Bound"
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="none"
                fill="url(#colorConfidence)"
                name="Lower Bound"
              />

              {/* Predicted price */}
              <Area
                type="monotone"
                dataKey="price"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#colorPrice)"
                name="Predicted Price"
              />

              {/* Current price marker */}
              {chartData[0]?.current && (
                <Line
                  type="monotone"
                  dataKey="current"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Current Price"
                  dot={false}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Prediction Insights */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-muted/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" />
                Price Target Range
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Lower Bound</span>
                <span className="font-medium">
                  ${chartData[chartData.length - 1]?.lower.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Upper Bound</span>
                <span className="font-medium">
                  ${chartData[chartData.length - 1]?.upper.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Model Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Direction Accuracy</span>
                <span className="font-medium">
                  {(predictions.directional_accuracy * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Overall Confidence</span>
                <span className="font-medium">
                  {(predictions.confidence * 100).toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Disclaimer */}
        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
          <p className="flex items-start gap-2">
            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              AI predictions are for informational purposes only and should not be considered as financial advice.
              Past performance does not guarantee future results. Model accuracy: {(predictions.model_accuracy * 100).toFixed(1)}%
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
