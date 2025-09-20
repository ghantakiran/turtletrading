/**
 * Backtest Configuration Form
 *
 * Comprehensive form for configuring trading strategies, universe selection,
 * risk management, and backtesting parameters.
 */

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { backtestService } from '../../services/backtestService';
import { useUIStore } from '../../stores';
import type { BacktestConfiguration, TradingStrategy, TradingRule } from '../../types';

interface BacktestConfigurationFormProps {
  onRunBacktest: (configuration: BacktestConfiguration) => void;
  isRunning: boolean;
}

interface FormData {
  // Strategy Configuration
  strategyName: string;
  strategyDescription: string;
  strategyType: 'momentum' | 'mean_reversion' | 'trend_following' | 'custom';

  // Universe Configuration
  universe: string;
  customSymbols: string;

  // Date Range
  startDate: string;
  endDate: string;

  // Capital & Risk
  initialCapital: number;
  maxPositions: number;
  cashBuffer: number;

  // Position Sizing
  positionSizingMethod: 'fixed' | 'percent_equity' | 'volatility_normalized' | 'kelly_criterion';
  positionSize: number;

  // Risk Management
  stopLossPct: number;
  takeProfitPct: number;
  maxPositionSize: number;
  maxPortfolioRisk: number;
  maxDailyTrades: number;
  drawdownLimit: number;

  // Transaction Costs
  perTradeCost: number;
  percentageCost: number;
  minCommission: number;
  slippageBps: number;

  // Advanced Options
  enableWalkForward: boolean;
  trainingPeriodMonths: number;
  validationPeriodMonths: number;
  stepSizeMonths: number;
  rebalancingFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  benchmarkSymbol: string;

  // Trading Rules
  tradingRules: Array<{
    name: string;
    indicator: string;
    condition: string;
    value: number;
    weight: number;
  }>;
}

const BacktestConfigurationForm: React.FC<BacktestConfigurationFormProps> = ({
  onRunBacktest,
  isRunning
}) => {
  const { showNotification } = useUIStore();
  const [strategyTemplates, setStrategyTemplates] = useState<TradingStrategy[]>([]);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      strategyName: 'Simple Momentum Strategy',
      strategyDescription: 'Buy stocks with strong momentum and good technical indicators',
      strategyType: 'momentum',
      universe: 'default',
      customSymbols: '',
      startDate: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      initialCapital: 100000,
      maxPositions: 10,
      cashBuffer: 5,
      positionSizingMethod: 'percent_equity',
      positionSize: 5,
      stopLossPct: 5,
      takeProfitPct: 15,
      maxPositionSize: 10,
      maxPortfolioRisk: 2,
      maxDailyTrades: 10,
      drawdownLimit: 15,
      perTradeCost: 1,
      percentageCost: 0.1,
      minCommission: 1,
      slippageBps: 10,
      enableWalkForward: false,
      trainingPeriodMonths: 12,
      validationPeriodMonths: 3,
      stepSizeMonths: 1,
      rebalancingFrequency: 'weekly',
      benchmarkSymbol: 'SPY',
      tradingRules: [
        { name: 'RSI Below 70', indicator: 'RSI', condition: 'below', value: 70, weight: 0.3 },
        { name: 'Price Above SMA 20', indicator: 'SMA_20', condition: 'above', value: 0, weight: 0.4 },
        { name: 'High Volume', indicator: 'Volume', condition: 'above', value: 1.5, weight: 0.3 }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'tradingRules'
  });

  // Load strategy templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const templates = await backtestService.getStrategyTemplates();
        setStrategyTemplates(templates);
      } catch (error) {
        console.error('Failed to load strategy templates:', error);
      }
    };
    loadTemplates();
  }, []);

  const watchedStrategyType = watch('strategyType');
  const watchedUniverse = watch('universe');

  const handleValidateStrategy = async () => {
    try {
      setIsValidating(true);
      const formData = watch();
      const strategy = convertFormDataToStrategy(formData);

      const result = await backtestService.validateStrategy(strategy);
      setValidationResult(result);

      if (result.valid) {
        showNotification({
          type: 'success',
          title: 'Strategy Valid',
          message: `Strategy validated successfully. Risk level: ${result.risk_level}`,
          duration: 3000
        });
      } else {
        showNotification({
          type: 'warning',
          title: 'Strategy Issues',
          message: `Found ${result.errors.length} errors and ${result.warnings.length} warnings`,
          duration: 5000
        });
      }
    } catch (error) {
      showNotification({
        type: 'error',
        title: 'Validation Failed',
        message: 'Failed to validate strategy configuration',
        duration: 5000
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleLoadTemplate = (template: TradingStrategy) => {
    setValue('strategyName', template.name);
    setValue('strategyDescription', template.description);
    setValue('strategyType', template.strategy_type);
    setValue('positionSizingMethod', template.position_sizing.method);
    setValue('positionSize', template.position_sizing.size);
    setValue('stopLossPct', template.risk_management.stop_loss_pct || 5);
    setValue('takeProfitPct', template.risk_management.take_profit_pct || 15);
    setValue('maxPositionSize', template.risk_management.max_position_size);
    setValue('maxPortfolioRisk', template.risk_management.max_portfolio_risk);
    setValue('maxDailyTrades', template.risk_management.max_daily_trades);
    setValue('drawdownLimit', template.risk_management.drawdown_limit);

    // Update trading rules
    const rules = template.rules.map(rule => ({
      name: rule.name,
      indicator: rule.indicator,
      condition: rule.condition,
      value: rule.value,
      weight: rule.weight
    }));
    setValue('tradingRules', rules);

    showNotification({
      type: 'info',
      title: 'Template Loaded',
      message: `Loaded "${template.name}" template`,
      duration: 3000
    });
  };

  const convertFormDataToStrategy = (formData: FormData): TradingStrategy => {
    return {
      name: formData.strategyName,
      description: formData.strategyDescription,
      strategy_type: formData.strategyType,
      rules: formData.tradingRules.map((rule, index) => ({
        id: `rule_${index}`,
        name: rule.name,
        indicator: rule.indicator,
        condition: rule.condition as any,
        value: rule.value,
        weight: rule.weight
      })),
      entry_conditions: formData.tradingRules.map(rule => ({
        indicator: rule.indicator,
        operator: rule.condition === 'above' ? '>' : rule.condition === 'below' ? '<' : '==' as any,
        value: rule.value,
        timeframe: 'daily'
      })),
      exit_conditions: [
        {
          indicator: 'RSI',
          operator: '>',
          value: 80,
          timeframe: 'daily'
        }
      ],
      risk_management: {
        stop_loss_pct: formData.stopLossPct,
        take_profit_pct: formData.takeProfitPct,
        max_position_size: formData.maxPositionSize,
        max_portfolio_risk: formData.maxPortfolioRisk,
        max_daily_trades: formData.maxDailyTrades,
        drawdown_limit: formData.drawdownLimit
      },
      position_sizing: {
        method: formData.positionSizingMethod,
        size: formData.positionSize,
        lookback_period: 20,
        risk_free_rate: 0.02,
        confidence_level: 0.95
      }
    };
  };

  const convertFormDataToConfiguration = (formData: FormData): BacktestConfiguration => {
    const strategy = convertFormDataToStrategy(formData);

    // Determine universe
    let universe: string[];
    if (formData.universe === 'custom') {
      universe = formData.customSymbols.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
    } else if (formData.universe === 'sp500') {
      universe = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'UNH', 'V', 'PG', 'HD', 'MA', 'DIS', 'PYPL', 'ADBE', 'CRM', 'NFLX', 'PFE', 'TMO'];
    } else {
      universe = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'UNH', 'V'];
    }

    return {
      strategy,
      universe,
      start_date: formData.startDate,
      end_date: formData.endDate,
      initial_capital: formData.initialCapital,
      transaction_costs: {
        per_trade_cost: formData.perTradeCost,
        percentage_cost: formData.percentageCost / 100,
        min_commission: formData.minCommission,
        market_impact_model: 'linear',
        spread_cost_bps: 5
      },
      slippage_model: {
        model_type: 'linear',
        slippage_bps: formData.slippageBps,
        market_impact_coeff: 0.1,
        temporary_impact_decay: 0.5
      },
      benchmark_symbols: [formData.benchmarkSymbol],
      walk_forward: formData.enableWalkForward ? {
        training_period_months: formData.trainingPeriodMonths,
        validation_period_months: formData.validationPeriodMonths,
        step_size_months: formData.stepSizeMonths,
        min_training_samples: 252
      } : undefined,
      rebalancing_frequency: formData.rebalancingFrequency,
      max_positions: formData.maxPositions,
      cash_buffer: formData.cashBuffer / 100
    };
  };

  const onSubmit = (formData: FormData) => {
    const configuration = convertFormDataToConfiguration(formData);
    onRunBacktest(configuration);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Strategy Templates */}
      {strategyTemplates.length > 0 && (
        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Strategy Templates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {strategyTemplates.map((template, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleLoadTemplate(template)}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 text-left transition-colors"
                >
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{template.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{template.description}</div>
                  <div className="text-xs text-primary-600 dark:text-primary-400 mt-2 capitalize">
                    {template.strategy_type.replace('_', ' ')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Strategy Configuration */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Strategy Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Strategy Name
              </label>
              <input
                {...register('strategyName', { required: 'Strategy name is required' })}
                type="text"
                className="input"
                placeholder="Enter strategy name"
              />
              {errors.strategyName && (
                <p className="text-bear-500 text-sm mt-1">{errors.strategyName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Strategy Type
              </label>
              <select {...register('strategyType')} className="input">
                <option value="momentum">Momentum</option>
                <option value="mean_reversion">Mean Reversion</option>
                <option value="trend_following">Trend Following</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                {...register('strategyDescription')}
                rows={3}
                className="input"
                placeholder="Describe your trading strategy..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Trading Rules */}
      <div className="card">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Trading Rules</h3>
            <button
              type="button"
              onClick={() => append({ name: '', indicator: 'RSI', condition: 'below', value: 50, weight: 0.1 })}
              className="btn btn-secondary btn-sm"
            >
              Add Rule
            </button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Rule Name
                    </label>
                    <input
                      {...register(`tradingRules.${index}.name` as const)}
                      type="text"
                      className="input"
                      placeholder="Rule name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Indicator
                    </label>
                    <select {...register(`tradingRules.${index}.indicator` as const)} className="input">
                      <option value="RSI">RSI</option>
                      <option value="MACD">MACD</option>
                      <option value="SMA_20">SMA 20</option>
                      <option value="SMA_50">SMA 50</option>
                      <option value="SMA_200">SMA 200</option>
                      <option value="EMA_20">EMA 20</option>
                      <option value="Volume">Volume</option>
                      <option value="Price">Price</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Condition
                    </label>
                    <select {...register(`tradingRules.${index}.condition` as const)} className="input">
                      <option value="above">Above</option>
                      <option value="below">Below</option>
                      <option value="cross_above">Cross Above</option>
                      <option value="cross_below">Cross Below</option>
                      <option value="equals">Equals</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Value
                    </label>
                    <input
                      {...register(`tradingRules.${index}.value` as const, { valueAsNumber: true })}
                      type="number"
                      step="0.01"
                      className="input"
                    />
                  </div>

                  <div className="flex items-end space-x-2">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Weight
                      </label>
                      <input
                        {...register(`tradingRules.${index}.weight` as const, { valueAsNumber: true })}
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        className="input"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="btn btn-bear btn-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Universe Selection */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Universe Selection</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stock Universe
              </label>
              <select {...register('universe')} className="input">
                <option value="default">Default Portfolio (10 stocks)</option>
                <option value="sp500">S&P 500 Sample (20 stocks)</option>
                <option value="custom">Custom Symbols</option>
              </select>
            </div>

            {watchedUniverse === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Custom Symbols
                </label>
                <input
                  {...register('customSymbols')}
                  type="text"
                  className="input"
                  placeholder="AAPL,MSFT,GOOGL,AMZN,TSLA"
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated list of stock symbols</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date Range & Capital */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Backtest Parameters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date
              </label>
              <input
                {...register('startDate', { required: 'Start date is required' })}
                type="date"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Date
              </label>
              <input
                {...register('endDate', { required: 'End date is required' })}
                type="date"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Initial Capital ($)
              </label>
              <input
                {...register('initialCapital', { required: 'Initial capital is required', min: 1000 })}
                type="number"
                className="input"
                placeholder="100000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Positions
              </label>
              <input
                {...register('maxPositions', { required: true, min: 1, max: 50 })}
                type="number"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cash Buffer (%)
              </label>
              <input
                {...register('cashBuffer', { required: true, min: 0, max: 50 })}
                type="number"
                step="0.1"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rebalancing
              </label>
              <select {...register('rebalancingFrequency')} className="input">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Position Sizing & Risk Management */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Position Sizing & Risk Management</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Position Sizing Method
              </label>
              <select {...register('positionSizingMethod')} className="input">
                <option value="fixed">Fixed Amount</option>
                <option value="percent_equity">Percent of Equity</option>
                <option value="volatility_normalized">Volatility Normalized</option>
                <option value="kelly_criterion">Kelly Criterion</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Position Size (%)
              </label>
              <input
                {...register('positionSize', { required: true, min: 0.1, max: 100 })}
                type="number"
                step="0.1"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stop Loss (%)
              </label>
              <input
                {...register('stopLossPct', { min: 0.1, max: 50 })}
                type="number"
                step="0.1"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Take Profit (%)
              </label>
              <input
                {...register('takeProfitPct', { min: 0.1, max: 200 })}
                type="number"
                step="0.1"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Position Size (%)
              </label>
              <input
                {...register('maxPositionSize', { min: 1, max: 100 })}
                type="number"
                step="0.1"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Portfolio Risk (%)
              </label>
              <input
                {...register('maxPortfolioRisk', { min: 0.1, max: 10 })}
                type="number"
                step="0.1"
                className="input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Costs */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Transaction Costs & Slippage</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Per Trade Cost ($)
              </label>
              <input
                {...register('perTradeCost', { min: 0 })}
                type="number"
                step="0.01"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Percentage Cost (%)
              </label>
              <input
                {...register('percentageCost', { min: 0, max: 1 })}
                type="number"
                step="0.001"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Min Commission ($)
              </label>
              <input
                {...register('minCommission', { min: 0 })}
                type="number"
                step="0.01"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Slippage (bps)
              </label>
              <input
                {...register('slippageBps', { min: 0, max: 100 })}
                type="number"
                className="input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Advanced Options</h3>

          <div className="mb-6">
            <label className="flex items-center">
              <input
                {...register('enableWalkForward')}
                type="checkbox"
                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Walk-Forward Optimization
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Improves robustness by testing on multiple out-of-sample periods
            </p>
          </div>

          {watch('enableWalkForward') && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Training Period (months)
                </label>
                <input
                  {...register('trainingPeriodMonths', { min: 3, max: 60 })}
                  type="number"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Validation Period (months)
                </label>
                <input
                  {...register('validationPeriodMonths', { min: 1, max: 12 })}
                  type="number"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Step Size (months)
                </label>
                <input
                  {...register('stepSizeMonths', { min: 1, max: 6 })}
                  type="number"
                  className="input"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Benchmark Symbol
            </label>
            <input
              {...register('benchmarkSymbol')}
              type="text"
              className="input max-w-xs"
              placeholder="SPY"
            />
          </div>
        </div>
      </div>

      {/* Validation Results */}
      {validationResult && (
        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Strategy Validation</h3>

            <div className={`p-4 rounded-lg mb-4 ${
              validationResult.valid
                ? 'bg-bull-50 border border-bull-200 dark:bg-bull-900/20 dark:border-bull-800'
                : 'bg-bear-50 border border-bear-200 dark:bg-bear-900/20 dark:border-bear-800'
            }`}>
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full mr-3 ${
                  validationResult.valid ? 'bg-bull-500' : 'bg-bear-500'
                }`} />
                <span className={`font-medium ${
                  validationResult.valid
                    ? 'text-bull-800 dark:text-bull-200'
                    : 'text-bear-800 dark:text-bear-200'
                }`}>
                  {validationResult.valid ? 'Strategy Valid' : 'Strategy has issues'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Risk Level: <span className={`${
                    validationResult.risk_level === 'HIGH' ? 'text-bear-600' :
                    validationResult.risk_level === 'MEDIUM' ? 'text-warning-600' :
                    'text-bull-600'
                  }`}>{validationResult.risk_level}</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Estimated trades per year: {validationResult.estimated_trades_per_year}
                </div>
              </div>
            </div>

            {validationResult.errors.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-bear-800 dark:text-bear-200 mb-2">Errors:</h4>
                <ul className="list-disc list-inside text-sm text-bear-600 dark:text-bear-400 space-y-1">
                  {validationResult.errors.map((error: string, index: number) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationResult.warnings.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-warning-800 dark:text-warning-200 mb-2">Warnings:</h4>
                <ul className="list-disc list-inside text-sm text-warning-600 dark:text-warning-400 space-y-1">
                  {validationResult.warnings.map((warning: string, index: number) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <div className="space-x-3">
          <button
            type="button"
            onClick={handleValidateStrategy}
            disabled={isValidating}
            className="btn btn-secondary"
          >
            {isValidating ? 'Validating...' : 'Validate Strategy'}
          </button>

          <button
            type="button"
            onClick={() => reset()}
            className="btn btn-ghost"
          >
            Reset Form
          </button>
        </div>

        <button
          type="submit"
          disabled={isRunning || isValidating}
          className="btn btn-primary"
        >
          {isRunning ? 'Running Backtest...' : 'Run Backtest'}
        </button>
      </div>
    </form>
  );
};

export default BacktestConfigurationForm;