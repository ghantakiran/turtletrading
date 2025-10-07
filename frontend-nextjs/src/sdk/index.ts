/**
 * TurtleTrading SDK
 * Official TypeScript/JavaScript client library
 *
 * @example
 * ```typescript
 * import { TurtleTradingClient } from '@turtletrading/sdk'
 *
 * const client = new TurtleTradingClient({ apiKey: 'your-api-key' })
 *
 * // Get stock price
 * const price = await client.stocks.getPrice('AAPL')
 *
 * // Get AI predictions
 * const predictions = await client.ai.getPredictions('AAPL', 7)
 *
 * // Get sentiment analysis
 * const sentiment = await client.sentiment.getAnalysis('AAPL')
 * ```
 */

export { TurtleTradingClient, createClient } from './client'
export type * from './types'
