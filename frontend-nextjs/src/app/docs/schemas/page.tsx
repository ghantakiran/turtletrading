import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function SchemasPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Data Models & Schemas</h1>
        <p className="text-xl text-muted-foreground">
          API response structures and data types
        </p>
      </div>

      {/* Stock Price Schema */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Stock Price Response</h2>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>GET /api/v1/stocks/{'{symbol}'}/price</CardTitle>
              <Badge>200 OK</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">{`{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "current_price": 175.43,
  "change": 2.15,
  "change_percent": 1.24,
  "volume": 52847392,
  "market_cap": 2750000000000,
  "pe_ratio": 28.5,
  "dividend_yield": 0.52,
  "52_week_high": 199.62,
  "52_week_low": 124.17,
  "market_status": "open",
  "last_updated": "2025-10-04T15:30:00Z"
}`}</pre>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Technical Analysis Schema */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Technical Analysis Response</h2>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>GET /api/v1/stocks/{'{symbol}'}/technical</CardTitle>
              <Badge>200 OK</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">{`{
  "symbol": "AAPL",
  "rsi": {
    "value": 65.4,
    "signal": "neutral",
    "description": "Neither overbought nor oversold"
  },
  "macd": {
    "macd": 1.23,
    "signal": 0.98,
    "histogram": 0.25,
    "trend": "bullish"
  },
  "moving_averages": {
    "sma_20": 173.5,
    "sma_50": 170.2,
    "sma_200": 165.8,
    "ema_12": 174.1,
    "ema_26": 171.3
  },
  "bollinger_bands": {
    "upper": 178.5,
    "middle": 175.0,
    "lower": 171.5,
    "position": "middle"
  },
  "recommendation": "buy",
  "confidence": 0.72,
  "last_updated": "2025-10-04T15:30:00Z"
}`}</pre>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LSTM Prediction Schema */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">AI Prediction Response</h2>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>GET /api/v1/stocks/{'{symbol}'}/lstm?days=5</CardTitle>
              <Badge>200 OK</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">{`{
  "symbol": "AAPL",
  "current_price": 175.43,
  "predictions": [
    {
      "date": "2025-10-05",
      "predicted_price": 176.8,
      "confidence_lower": 174.2,
      "confidence_upper": 179.4,
      "change_percent": 0.78
    },
    {
      "date": "2025-10-06",
      "predicted_price": 177.5,
      "confidence_lower": 173.9,
      "confidence_upper": 181.1,
      "change_percent": 1.18
    }
  ],
  "model_confidence": 0.85,
  "trend": "bullish",
  "generated_at": "2025-10-04T15:30:00Z"
}`}</pre>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Types */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Common Data Types</h2>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timestamps</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              All timestamps use ISO 8601 format in UTC timezone: <code className="bg-muted px-2 py-1 rounded">2025-10-04T15:30:00Z</code>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prices & Values</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              All monetary values are floating-point numbers representing USD: <code className="bg-muted px-2 py-1 rounded">175.43</code>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Percentages</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Percentage values are decimals (1.24 = 1.24%, not 0.0124)
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Signals</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Indicator signals are strings: <code className="bg-muted px-2 py-1 rounded">"buy"</code>, <code className="bg-muted px-2 py-1 rounded">"sell"</code>, <code className="bg-muted px-2 py-1 rounded">"neutral"</code>, <code className="bg-muted px-2 py-1 rounded">"bullish"</code>, <code className="bg-muted px-2 py-1 rounded">"bearish"</code>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
