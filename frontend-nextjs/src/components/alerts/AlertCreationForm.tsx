'use client'

/**
 * AlertCreationForm Component
 * Form for creating custom price and technical indicator alerts
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bell, Plus, X } from 'lucide-react'
import useMarketStore from '@/stores/marketStore'
import { useUIStore } from '@/stores/uiStore'

interface AlertCreationFormProps {
  defaultSymbol?: string
  onCancel?: () => void
  onSuccess?: () => void
}

type AlertType = 'price_above' | 'price_below' | 'volume_spike' | 'rsi_overbought' | 'rsi_oversold' | 'regime_change' | 'anomaly' | 'volatility_spike'

export function AlertCreationForm({ defaultSymbol = '', onCancel, onSuccess }: AlertCreationFormProps) {
  const { createAlert } = useMarketStore()
  const { showNotification } = useUIStore()

  const [symbol, setSymbol] = useState(defaultSymbol)
  const [alertType, setAlertType] = useState<AlertType>('price_above')
  const [condition, setCondition] = useState('')
  const [errors, setErrors] = useState<{ symbol?: string; condition?: string }>({})

  const alertTypes: { value: AlertType; label: string; description: string }[] = [
    { value: 'price_above', label: 'Price Above', description: 'Alert when price crosses above threshold' },
    { value: 'price_below', label: 'Price Below', description: 'Alert when price drops below threshold' },
    { value: 'volume_spike', label: 'Volume Spike', description: 'Alert on unusual volume activity' },
    { value: 'rsi_overbought', label: 'RSI Overbought', description: 'Alert when RSI > 70' },
    { value: 'rsi_oversold', label: 'RSI Oversold', description: 'Alert when RSI < 30' },
    { value: 'volatility_spike', label: 'Volatility Spike', description: 'Alert on high volatility' },
    { value: 'regime_change', label: 'Regime Change', description: 'Alert on market regime shift' },
    { value: 'anomaly', label: 'Anomaly Detected', description: 'Alert on unusual patterns' },
  ]

  const validateForm = (): boolean => {
    const newErrors: { symbol?: string; condition?: string } = {}

    if (!symbol.trim()) {
      newErrors.symbol = 'Symbol is required'
    } else if (!/^[A-Z]{1,5}$/.test(symbol.toUpperCase())) {
      newErrors.symbol = 'Invalid symbol format'
    }

    if (alertType === 'price_above' || alertType === 'price_below') {
      const conditionNum = parseFloat(condition)
      if (!condition || isNaN(conditionNum) || conditionNum <= 0) {
        newErrors.condition = 'Valid price is required'
      }
    } else if (alertType === 'volume_spike') {
      const conditionNum = parseFloat(condition)
      if (!condition || isNaN(conditionNum) || conditionNum <= 0) {
        newErrors.condition = 'Valid volume threshold is required'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const conditionValue = parseFloat(condition) || 0

    createAlert({
      symbol: symbol.toUpperCase(),
      type: alertType,
      condition: conditionValue,
      isActive: true
    })

    showNotification({
      type: 'success',
      title: 'Alert Created',
      message: `Alert for ${symbol.toUpperCase()} has been created successfully`
    })

    // Clear form
    setSymbol(defaultSymbol)
    setAlertType('price_above')
    setCondition('')
    setErrors({})

    if (onSuccess) {
      onSuccess()
    }
  }

  const handleCancel = () => {
    setSymbol(defaultSymbol)
    setAlertType('price_above')
    setCondition('')
    setErrors({})

    if (onCancel) {
      onCancel()
    }
  }

  const getConditionLabel = (): string => {
    switch (alertType) {
      case 'price_above':
      case 'price_below':
        return 'Price ($)'
      case 'volume_spike':
        return 'Volume Threshold'
      default:
        return 'Value'
    }
  }

  const needsConditionInput = (): boolean => {
    return ['price_above', 'price_below', 'volume_spike'].includes(alertType)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Create New Alert
        </CardTitle>
        <CardDescription>
          Set up custom alerts for price movements and technical indicators
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Symbol Input */}
          <div className="space-y-2">
            <Label htmlFor="symbol">Stock Symbol</Label>
            <Input
              id="symbol"
              placeholder="e.g., AAPL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className={errors.symbol ? 'border-red-500' : ''}
            />
            {errors.symbol && (
              <p className="text-sm text-red-600">{errors.symbol}</p>
            )}
          </div>

          {/* Alert Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="alert-type">Alert Type</Label>
            <Select value={alertType} onValueChange={(value) => setAlertType(value as AlertType)}>
              <SelectTrigger id="alert-type">
                <SelectValue placeholder="Select alert type" />
              </SelectTrigger>
              <SelectContent>
                {alertTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{type.label}</span>
                      <span className="text-xs text-muted-foreground">{type.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Input */}
          {needsConditionInput() && (
            <div className="space-y-2">
              <Label htmlFor="condition">{getConditionLabel()}</Label>
              <Input
                id="condition"
                type="number"
                step="0.01"
                placeholder={alertType === 'price_above' ? 'e.g., 150.00' : 'Enter value'}
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className={errors.condition ? 'border-red-500' : ''}
              />
              {errors.condition && (
                <p className="text-sm text-red-600">{errors.condition}</p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">
              <Plus className="w-4 h-4 mr-2" />
              Create Alert
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
