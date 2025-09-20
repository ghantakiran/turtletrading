/**
 * Backtesting Service
 *
 * Handles API calls for portfolio backtesting including strategy validation,
 * backtest execution, result retrieval, and job management.
 */

import { apiClient } from './apiClient';
import type {
  BacktestRequest,
  BacktestResult,
  BacktestStatus,
  BacktestConfiguration,
  TradingStrategy,
  PerformanceMetrics
} from '../types';

export class BacktestService {
  private readonly baseUrl = '/api/v1/backtest';

  /**
   * Run a comprehensive portfolio backtest
   */
  async runBacktest(request: BacktestRequest): Promise<{ job_id: string; status: string; message: string }> {
    const response = await apiClient.post<{ job_id: string; status: string; message: string }>(`${this.baseUrl}/run`, request);
    return response;
  }

  /**
   * Get status of a running or completed backtest job
   */
  async getBacktestStatus(jobId: string): Promise<BacktestStatus> {
    const response = await apiClient.get<BacktestStatus>(`${this.baseUrl}/status/${jobId}`);
    return response;
  }

  /**
   * Get results of a completed backtest
   */
  async getBacktestResult(jobId: string): Promise<BacktestResult> {
    const response = await apiClient.get<BacktestResult>(`${this.baseUrl}/result/${jobId}`);
    return response;
  }

  /**
   * Validate a trading strategy configuration
   */
  async validateStrategy(strategy: TradingStrategy): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    estimated_trades_per_year: number;
    risk_level: string;
  }> {
    const response = await apiClient.post<{
      valid: boolean;
      errors: string[];
      warnings: string[];
      estimated_trades_per_year: number;
      risk_level: string;
    }>(`${this.baseUrl}/validate`, strategy);
    return response;
  }

  /**
   * Get predefined strategy templates
   */
  async getStrategyTemplates(): Promise<TradingStrategy[]> {
    const response = await apiClient.get<TradingStrategy[]>(`${this.baseUrl}/templates`);
    return response;
  }

  /**
   * Run a quick backtest for simple strategies
   */
  async runQuickBacktest(configuration: BacktestConfiguration): Promise<BacktestResult> {
    const response = await apiClient.post<BacktestResult>(`${this.baseUrl}/quick`, configuration);
    return response;
  }

  /**
   * Validate trading universe symbols
   */
  async validateUniverse(
    symbols: string[],
    startDate?: string,
    endDate?: string
  ): Promise<{
    valid_symbols: string[];
    invalid_symbols: string[];
    data_coverage: Record<string, number>;
    warnings: string[];
    survivorship_bias_risk: string;
  }> {
    const params = new URLSearchParams();
    symbols.forEach(symbol => params.append('symbols', symbol));
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const response = await apiClient.get<{
      valid_symbols: string[];
      invalid_symbols: string[];
      data_coverage: Record<string, number>;
      warnings: string[];
      survivorship_bias_risk: string;
    }>(`${this.baseUrl}/universe/validate?${params.toString()}`);
    return response;
  }

  /**
   * Get benchmark performance metrics
   */
  async getBenchmarkMetrics(
    symbol: string,
    startDate: string,
    endDate: string
  ): Promise<PerformanceMetrics> {
    const params = new URLSearchParams({
      symbol,
      start_date: startDate,
      end_date: endDate
    });

    const response = await apiClient.get<PerformanceMetrics>(`${this.baseUrl}/metrics/benchmark?${params.toString()}`);
    return response;
  }

  /**
   * Compare multiple trading strategies
   */
  async compareStrategies(
    strategyConfigs: BacktestConfiguration[]
  ): Promise<{ job_id: string; status: string; message: string }> {
    const response = await apiClient.post<{ job_id: string; status: string; message: string }>(`${this.baseUrl}/compare`, strategyConfigs);
    return response;
  }

  /**
   * List recent backtest jobs
   */
  async listBacktestJobs(
    status?: string,
    limit: number = 50
  ): Promise<BacktestStatus[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', limit.toString());

    const response = await apiClient.get<BacktestStatus[]>(`${this.baseUrl}/jobs?${params.toString()}`);
    return response;
  }

  /**
   * Cancel a running backtest job
   */
  async cancelBacktestJob(jobId: string): Promise<{ job_id: string; status: string; message: string }> {
    const response = await apiClient.delete<{ job_id: string; status: string; message: string }>(`${this.baseUrl}/job/${jobId}`);
    return response;
  }

  /**
   * Health check for backtesting service
   */
  async healthCheck(): Promise<{
    status: string;
    service: string;
    features: string[];
    position_sizing_methods: string[];
    active_jobs: number;
    total_jobs: number;
  }> {
    const response = await apiClient.get<{
      status: string;
      service: string;
      features: string[];
      position_sizing_methods: string[];
      active_jobs: number;
      total_jobs: number;
    }>(`${this.baseUrl}/health`);
    return response;
  }

  /**
   * Poll backtest status until completion
   */
  async pollBacktestCompletion(
    jobId: string,
    pollInterval: number = 2000,
    maxAttempts: number = 300,
    onProgress?: (status: BacktestStatus) => void
  ): Promise<BacktestResult> {
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++;
          const status = await this.getBacktestStatus(jobId);

          if (onProgress) {
            onProgress(status);
          }

          if (status.status === 'COMPLETED') {
            if (status.result) {
              resolve(status.result);
            } else {
              const result = await this.getBacktestResult(jobId);
              resolve(result);
            }
          } else if (status.status === 'FAILED') {
            reject(new Error(status.error || status.message || 'Backtest failed'));
          } else if (status.status === 'CANCELLED') {
            reject(new Error('Backtest was cancelled'));
          } else if (attempts >= maxAttempts) {
            reject(new Error(`Backtest timeout after ${maxAttempts} attempts`));
          } else {
            // Continue polling
            setTimeout(poll, pollInterval);
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  /**
   * Create default strategy configuration
   */
  createDefaultStrategy(): TradingStrategy {
    return {
      name: 'Simple Momentum Strategy',
      description: 'Buy stocks with strong momentum and RSI below 70',
      strategy_type: 'momentum',
      rules: [
        {
          id: 'rsi_rule',
          name: 'RSI Below 70',
          indicator: 'RSI',
          condition: 'below',
          value: 70,
          weight: 0.3
        },
        {
          id: 'sma_rule',
          name: 'Price Above SMA 20',
          indicator: 'SMA_20',
          condition: 'above',
          value: 0,
          weight: 0.4
        },
        {
          id: 'volume_rule',
          name: 'High Volume',
          indicator: 'Volume',
          condition: 'above',
          value: 1.5,
          weight: 0.3
        }
      ],
      entry_conditions: [
        {
          indicator: 'RSI',
          operator: '<',
          value: 70,
          timeframe: 'daily'
        },
        {
          indicator: 'Price',
          operator: '>',
          value: 0,
          timeframe: 'daily'
        }
      ],
      exit_conditions: [
        {
          indicator: 'RSI',
          operator: '>',
          value: 80,
          timeframe: 'daily'
        }
      ],
      risk_management: {
        stop_loss_pct: 5.0,
        take_profit_pct: 15.0,
        max_position_size: 10.0,
        max_portfolio_risk: 2.0,
        max_daily_trades: 10,
        drawdown_limit: 15.0
      },
      position_sizing: {
        method: 'percent_equity',
        size: 5.0,
        lookback_period: 20,
        risk_free_rate: 0.02,
        confidence_level: 0.95
      }
    };
  }

  /**
   * Create default backtest configuration
   */
  createDefaultConfiguration(): BacktestConfiguration {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 2);

    return {
      strategy: this.createDefaultStrategy(),
      universe: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'UNH', 'V'],
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      initial_capital: 100000,
      transaction_costs: {
        per_trade_cost: 1.0,
        percentage_cost: 0.001,
        min_commission: 1.0,
        market_impact_model: 'linear',
        spread_cost_bps: 5
      },
      slippage_model: {
        model_type: 'linear',
        slippage_bps: 10,
        market_impact_coeff: 0.1,
        temporary_impact_decay: 0.5
      },
      benchmark_symbols: ['SPY'],
      walk_forward: {
        training_period_months: 12,
        validation_period_months: 3,
        step_size_months: 1,
        min_training_samples: 252
      },
      rebalancing_frequency: 'weekly',
      max_positions: 10,
      cash_buffer: 0.05
    };
  }
}

// Export singleton instance
export const backtestService = new BacktestService();