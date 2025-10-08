# NDX Mean Reversion Strategy Guide
## TQQQ/SQQQ Portfolio ($10,000)

---

## 📋 Table of Contents
1. [Strategy Overview](#strategy-overview)
2. [Step-by-Step Algorithm](#step-by-step-algorithm)
3. [Signal Generation](#signal-generation)
4. [Position Sizing & Rebalancing](#position-sizing--rebalancing)
5. [Risk Management](#risk-management)
6. [Implementation](#implementation)
7. [Performance Metrics](#performance-metrics)

---

## Strategy Overview

### What is This Strategy?

This is a **mean reversion trading strategy** that:
- Uses the **NDX (NASDAQ-100 Index)** as the signal generator
- Trades **TQQQ** (3x leveraged long NDX) and **SQQQ** (3x leveraged short NDX)
- Rebalances **daily** based on how far NDX deviates from its mean
- Starts with **$10,000** capital

### Core Principle

**Mean reversion** = When NDX price moves far from its average, it tends to return back to the average.

- **NDX far BELOW average** → Price should rise → Buy TQQQ
- **NDX far ABOVE average** → Price should fall → Buy SQQQ

---

## Step-by-Step Algorithm

### Step 1: Data Collection

```python
# Fetch historical data
NDX_price_history = download("^NDX", start="2020-01-01", end="today")
TQQQ_price_history = download("TQQQ", start="2020-01-01", end="today")
SQQQ_price_history = download("SQQQ", start="2020-01-01", end="today")
```

**What we need:**
- NDX historical prices (daily close)
- TQQQ historical prices (for trading)
- SQQQ historical prices (for trading)

---

### Step 2: Calculate Rolling Mean & Standard Deviation

For each day, calculate the **20-day rolling statistics**:

```python
lookback_period = 20  # days

for each trading day:
    rolling_mean = average(NDX_price over last 20 days)
    rolling_std = std_deviation(NDX_price over last 20 days)
```

**Example:**
- Today's NDX price: 15,500
- 20-day average: 15,000
- 20-day std dev: 300

---

### Step 3: Calculate Z-Score

The **z-score** tells us how many standard deviations the current price is from the mean:

```python
z_score = (current_price - rolling_mean) / rolling_std
```

**Interpretation:**
- `z = 0`: Price is exactly at the mean (neutral)
- `z = +2`: Price is 2 std devs ABOVE mean (expensive, likely to fall)
- `z = -2`: Price is 2 std devs BELOW mean (cheap, likely to rise)

**Example calculation:**
```
NDX price = 15,500
Mean = 15,000
Std = 300

z_score = (15,500 - 15,000) / 300 = +1.67
```

This means NDX is **1.67 standard deviations above** its mean → **overvalued** → expect it to fall

---

### Step 4: Generate Trading Signals

Based on the z-score, determine what % of portfolio should be in TQQQ vs SQQQ:

| Z-Score Range | Signal | TQQQ % | SQQQ % | Interpretation |
|---------------|--------|--------|--------|----------------|
| z ≤ -1.5 | **STRONG BUY** | 100% | 0% | NDX way below mean → expect bounce up |
| -1.5 < z ≤ -0.5 | **WEAK BUY** | 70-100% | 0-30% | NDX below mean → slight bullish |
| -0.5 < z < 0.5 | **NEUTRAL** | 50% | 50% | NDX near mean → no strong signal |
| 0.5 ≤ z < 1.5 | **WEAK SELL** | 0-30% | 70-100% | NDX above mean → slight bearish |
| z ≥ 1.5 | **STRONG SELL** | 0% | 100% | NDX way above mean → expect fall |

**Example signal generation:**

```python
def get_allocation(z_score):
    if z_score <= -1.5:
        return (100%, 0%)  # All TQQQ
    
    elif -1.5 < z_score <= -0.5:
        # Linear interpolation: 70-100% TQQQ
        tqqq_pct = 70 + 30 * ((abs(z_score) - 0.5) / (1.5 - 0.5))
        return (tqqq_pct, 100 - tqqq_pct)
    
    elif -0.5 < z_score < 0.5:
        return (50%, 50%)  # Neutral
    
    elif 0.5 <= z_score < 1.5:
        # Linear interpolation: 30-0% TQQQ
        tqqq_pct = 30 * (1 - (z_score - 0.5) / (1.5 - 0.5))
        return (tqqq_pct, 100 - tqqq_pct)
    
    else:  # z_score >= 1.5
        return (0%, 100%)  # All SQQQ
```

---

### Step 5: Daily Rebalancing

**Every day**, adjust the portfolio to match the target allocation:

```python
# Current portfolio state
current_portfolio_value = cash + (tqqq_shares × tqqq_price) + (sqqq_shares × sqqq_price)

# Calculate target values
target_tqqq_value = current_portfolio_value × tqqq_target_pct
target_sqqq_value = current_portfolio_value × sqqq_target_pct

# Calculate required trades
tqqq_value_to_trade = target_tqqq_value - current_tqqq_value
sqqq_value_to_trade = target_sqqq_value - current_sqqq_value

# Execute trades
if abs(tqqq_value_to_trade) > $1:
    tqqq_shares_to_trade = tqqq_value_to_trade / tqqq_price
    execute_trade("TQQQ", tqqq_shares_to_trade)
    pay_commission(abs(tqqq_value_to_trade) × 0.1%)

if abs(sqqq_value_to_trade) > $1:
    sqqq_shares_to_trade = sqqq_value_to_trade / sqqq_price
    execute_trade("SQQQ", sqqq_shares_to_trade)
    pay_commission(abs(sqqq_value_to_trade) × 0.1%)
```

**Example rebalancing scenario:**

**Day 1 - STRONG BUY signal (z = -2.0)**
```
Portfolio value: $10,000
Signal: 100% TQQQ, 0% SQQQ
TQQQ price: $50

Action:
→ Buy $10,000 / $50 = 200 shares TQQQ
→ Sell all SQQQ (if any)
→ Pay commission: $10 (0.1% of $10,000)

Result:
- Cash: $0
- TQQQ: 200 shares ($10,000)
- SQQQ: 0 shares
```

**Day 2 - WEAK BUY signal (z = -0.8)**
```
Portfolio value: $10,100 (TQQQ rose slightly)
Signal: 80% TQQQ, 20% SQQQ
TQQQ price: $50.50
SQQQ price: $30.00

Current positions:
- TQQQ: 200 shares = $10,100
- SQQQ: 0 shares = $0

Target positions:
- TQQQ: $10,100 × 80% = $8,080
- SQQQ: $10,100 × 20% = $2,020

Action:
→ Sell TQQQ: ($10,100 - $8,080) = $2,020 worth
→ Buy SQQQ: $2,020 / $30 = 67.3 shares
→ Pay commission: ~$20

Result:
- TQQQ: 160 shares ($8,080)
- SQQQ: 67 shares ($2,020)
```

---

## Signal Generation Logic

### Visual Z-Score Zones

```
                    STRONG SELL
                    (100% SQQQ)
        ┌─────────────────────────────┐
  z=+1.5├─────────────────────────────┤
        │     WEAK SELL               │
        │  (Increase SQQQ allocation) │
  z=+0.5├─────────────────────────────┤
        │                             │
        │       NEUTRAL               │
        │    (50% TQQQ / 50% SQQQ)    │
  z= 0  ├─────────────────────────────┤
        │                             │
  z=-0.5├─────────────────────────────┤
        │     WEAK BUY                │
        │  (Increase TQQQ allocation) │
  z=-1.5├─────────────────────────────┤
        │                             │
        │     STRONG BUY              │
        │    (100% TQQQ)              │
        └─────────────────────────────┘
```

### Signal Examples with Real Numbers

**Scenario 1: NDX at 15,800, Mean = 15,000, Std = 300**
```
z = (15,800 - 15,000) / 300 = +2.67 → STRONG SELL

Action: 
- Sell ALL TQQQ
- Buy SQQQ with 100% of portfolio
- Expect NDX to fall back toward 15,000
```

**Scenario 2: NDX at 14,400, Mean = 15,000, Std = 300**
```
z = (14,400 - 15,000) / 300 = -2.0 → STRONG BUY

Action:
- Sell ALL SQQQ
- Buy TQQQ with 100% of portfolio
- Expect NDX to rise back toward 15,000
```

**Scenario 3: NDX at 15,100, Mean = 15,000, Std = 300**
```
z = (15,100 - 15,000) / 300 = +0.33 → NEUTRAL

Action:
- Hold 50% TQQQ, 50% SQQQ
- Wait for stronger signal
```

---

## Position Sizing & Rebalancing

### Daily Rebalancing Workflow

```
START OF DAY
│
├─ Get current NDX price
├─ Calculate z-score
├─ Determine target allocation (% TQQQ, % SQQQ)
│
├─ Calculate current portfolio value:
│   portfolio_value = cash + tqqq_value + sqqq_value
│
├─ Calculate target dollar amounts:
│   target_tqqq_value = portfolio_value × tqqq_target_pct
│   target_sqqq_value = portfolio_value × sqqq_target_pct
│
├─ Determine trades needed:
│   tqqq_trade = target_tqqq_value - current_tqqq_value
│   sqqq_trade = target_sqqq_value - current_sqqq_value
│
├─ Execute trades (if change > $1):
│   • Buy/Sell TQQQ shares
│   • Buy/Sell SQQQ shares
│   • Pay commissions (0.1% per trade)
│
└─ Log portfolio snapshot
    END OF DAY
```

### Transaction Costs

**Commission structure:**
- 0.1% per trade (0.001 × trade_value)
- Only trade if change > $1 (avoid tiny trades)

**Example:**
- Trade $5,000 worth of TQQQ → Commission = $5
- Trade $2,000 worth of SQQQ → Commission = $2
- Total cost: $7

---

## Risk Management

### 1. **Leverage Risk**
- TQQQ = 3x leverage (amplifies gains AND losses)
- SQQQ = 3x inverse leverage

**Example:**
- If NDX rises 1%, TQQQ rises ~3%, SQQQ falls ~3%
- If NDX falls 1%, TQQQ falls ~3%, SQQQ rises ~3%

### 2. **Volatility Decay**
- Leveraged ETFs experience **daily rebalancing decay**
- Long holding periods can erode value in choppy markets

### 3. **Diversification**
By holding BOTH TQQQ and SQQQ:
- Reduces extreme exposure
- Provides hedge in neutral zones
- Smooths volatility

### 4. **Stop Loss** (Optional Enhancement)
```python
if portfolio_value < initial_capital × 0.85:
    # Triggered 15% stop loss
    liquidate_all_positions()
    exit_strategy()
```

### 5. **Max Position Limits** (Optional Enhancement)
```python
max_tqqq_allocation = 0.70  # Never more than 70% TQQQ
max_sqqq_allocation = 0.70  # Never more than 70% SQQQ
min_cash_reserve = 0.05     # Keep 5% in cash
```

---

## Implementation

### Running the Strategy

```bash
# Install required packages
pip install yfinance pandas numpy matplotlib loguru

# Run the strategy
python ndx_mean_reversion_tqqq_sqqq_strategy.py
```

### Code Structure

```python
class NDXMeanReversionStrategy:
    
    def __init__(self, initial_capital=10000, lookback_period=20, ...):
        # Initialize parameters
    
    def fetch_data(self) -> bool:
        # Download NDX, TQQQ, SQQQ price history
    
    def calculate_signals(self) -> pd.DataFrame:
        # Compute rolling mean, std, z-score, allocations
    
    def backtest(self) -> Dict:
        # Simulate trading day-by-day with rebalancing
    
    def calculate_performance_metrics(self) -> Dict:
        # Calculate returns, Sharpe ratio, drawdown, etc.
    
    def plot_results(self):
        # Visualize performance, allocations, z-score
    
    def export_trades(self):
        # Export trade log to CSV
```

### Customization

You can adjust these parameters:

```python
strategy = NDXMeanReversionStrategy(
    initial_capital=10000.0,      # Starting capital
    lookback_period=20,            # Rolling window (days)
    entry_z_score=1.5,             # Strong signal threshold
    exit_z_score=0.5,              # Weak signal threshold
    commission_pct=0.001,          # 0.1% commission
    start_date="2020-01-01",       # Backtest start
    end_date=None                  # Backtest end (None = today)
)
```

**Parameter tuning suggestions:**
- **Short-term mean reversion**: `lookback_period=10-15`, `entry_z_score=1.0-1.5`
- **Long-term mean reversion**: `lookback_period=30-50`, `entry_z_score=2.0-2.5`
- **Conservative**: Lower TQQQ/SQQQ allocation caps (max 60% each)
- **Aggressive**: Allow 100% allocation to either side

---

## Performance Metrics

### Key Metrics Calculated

1. **Total Return %**
   ```
   total_return = (final_value - initial_capital) / initial_capital × 100
   ```

2. **CAGR (Compound Annual Growth Rate)**
   ```
   CAGR = (final_value / initial_capital)^(1/years) - 1
   ```

3. **Sharpe Ratio** (risk-adjusted return)
   ```
   sharpe = (CAGR - risk_free_rate) / annual_volatility
   ```
   - Higher is better (> 1.0 is good, > 2.0 is excellent)

4. **Max Drawdown** (largest peak-to-trough decline)
   ```
   max_drawdown = min((portfolio_value - cumulative_max) / cumulative_max)
   ```

5. **Win Rate**
   ```
   win_rate = (number of winning days / total trading days) × 100
   ```

6. **Volatility** (annualized)
   ```
   volatility = std(daily_returns) × sqrt(252)
   ```

### Benchmark Comparison

The strategy compares against **TQQQ Buy & Hold**:
```
tqqq_buy_hold_return = (tqqq_final_price / tqqq_initial_price) - 1
outperformance = strategy_return - tqqq_buy_hold_return
```

---

## Example Backtest Output

```
================================================================================
NDX MEAN REVERSION STRATEGY - TQQQ/SQQQ PORTFOLIO
================================================================================

📊 STRATEGY PARAMETERS:
  • Initial Capital:        $10,000.00
  • Lookback Period:        20 days
  • Entry Z-Score:          ±1.5
  • Exit Z-Score:           ±0.5
  • Commission:             0.10%
  • Period:                 2020-01-01 to 2025-10-05

💰 PERFORMANCE SUMMARY:
  • Final Portfolio Value:  $24,567.89
  • Total Return:           +145.68%
  • CAGR:                   25.34%
  • Annualized Volatility:  42.15%
  • Sharpe Ratio:           0.85
  • Max Drawdown:           -35.67%
  • Win Rate:               52.34%

📈 BENCHMARK COMPARISON:
  • TQQQ Buy & Hold Return: +132.45%
  • Strategy Outperformance:+13.23%

🔄 TRADING ACTIVITY:
  • Total Trades:           1,245
  • Trading Days:           1,234
  • Total Commissions:      $345.67
  • Avg Trades per Day:     1.01
================================================================================
```

---

## Visual Outputs

The strategy generates a comprehensive chart with 4 subplots:

1. **Portfolio Value Over Time**
   - Strategy performance vs TQQQ buy-and-hold

2. **NDX Price & Z-Score**
   - Shows when signals trigger (above/below thresholds)

3. **Portfolio Allocation**
   - Stacked area chart showing TQQQ % vs SQQQ %

4. **Drawdown Analysis**
   - Shows periods of portfolio decline

---

## Exported Data Files

1. **`ndx_mean_reversion_trades_YYYYMMDD_HHMMSS.csv`**
   - Complete trade log with dates, symbols, shares, prices, commissions

2. **`ndx_mean_reversion_portfolio_YYYYMMDD_HHMMSS.csv`**
   - Daily portfolio snapshots with allocations, z-scores, signals

3. **`ndx_mean_reversion_backtest_YYYYMMDD_HHMMSS.png`**
   - Performance visualization chart

---

## FAQ

### Q: Why use NDX instead of QQQ?
**A:** NDX is the actual index. QQQ tracks it but may have tracking error. If NDX data is unavailable, the script automatically falls back to QQQ.

### Q: Why 20-day lookback?
**A:** 20 trading days ≈ 1 month. It captures short-term mean reversion without being too noisy (10 days) or too slow (50 days). You can adjust this.

### Q: Why ±1.5 z-score thresholds?
**A:** Statistically, ±1.5 std devs covers ~86% of normal distribution. It filters out noise but catches meaningful deviations. Tune based on backtest results.

### Q: What if z-score is always between -0.5 and 0.5?
**A:** In low-volatility periods, you'll stay 50/50 TQQQ/SQQQ (neutral). This reduces risk when mean reversion signals are weak.

### Q: Can I trade this with real money?
**A:** This is a backtest. Paper trade first! Real trading involves:
- Slippage (price moves between signal and execution)
- Wider spreads
- Higher commissions
- Emotional discipline
- Tax implications (wash sales, short-term gains)

### Q: How do I improve the strategy?
**A:**
1. Add **regime filter** (only trade in mean-reverting regimes, not strong trends)
2. Add **volatility filter** (only trade when VIX is moderate)
3. Use **multiple timeframes** (5-day + 20-day z-scores)
4. **Reduce leverage** (trade QQQ instead of TQQQ/SQQQ for less risk)
5. **Add stop losses** (exit if down X%)

---

## Next Steps

1. **Run the backtest** with different date ranges
2. **Optimize parameters** (lookback, thresholds)
3. **Paper trade** for 1-3 months to validate
4. **Monitor live** signals vs NDX price action
5. **Compare** to buy-and-hold and other strategies

---

## Disclaimer

⚠️ **This strategy is for educational purposes only.**

- Past performance does not guarantee future results
- Leveraged ETFs (TQQQ/SQQQ) are high-risk instruments
- Mean reversion can fail during sustained trends
- Always use proper position sizing and risk management
- Consult a financial advisor before trading real money

---

## Contact & Support

For questions or improvements, see the TurtleTrading platform documentation.

**Happy Trading! 🚀📈**



