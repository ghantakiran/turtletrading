"""
Enhanced Mean Reversion Strategy with Capital Growth
=====================================================

This strategy implements:
1. Mean reversion signals based on z-score
2. Dynamic position sizing based on current portfolio value
3. Compounding gains to grow capital
4. Risk management with max position limits
5. Detailed performance tracking and visualization

Author: TurtleTrading Platform
Date: October 2025
"""

import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# ===========================
# PARAMETERS (Tweakable)
# ===========================

# Market Selection
TICKER = "^GSPC"            # S&P 500 index (or use ^NDX for NASDAQ-100)
YEARS = 40                  # Historical lookback period

# Mean Reversion Parameters
ROLL_WINDOW = 20            # Rolling window for mean/std (days)
Z_ENTRY = 2.0               # Z-score threshold to enter (absolute value)
Z_EXIT = 0.25               # Exit when z reverts to this magnitude

# Portfolio & Risk Management
INITIAL_CAPITAL = 10000.0   # Starting capital ($)
MAX_POSITION_SIZE = 1.0     # Max % of portfolio to risk per trade (1.0 = 100%)
USE_LEVERAGE = False        # Whether to allow leverage (>100% exposure)
MAX_LEVERAGE = 2.0          # Maximum leverage if USE_LEVERAGE=True

# Transaction Costs
TRANSACTION_COST = 0.001    # 0.1% per trade (round-trip)

# Date Range
START_DATE = (datetime.now() - pd.DateOffset(years=YEARS)).strftime("%Y-%m-%d")
END_DATE = datetime.now().strftime("%Y-%m-%d")

# ===========================
# DATA FETCHING
# ===========================

print("="*80)
print("ENHANCED MEAN REVERSION STRATEGY - CAPITAL GROWTH")
print("="*80)
print(f"\n📊 Fetching {YEARS} years of data for {TICKER}...")

df = yf.download(TICKER, start=START_DATE, end=END_DATE, progress=False)
if df.empty:
    raise SystemExit("❌ Downloaded data is empty — check ticker or internet connection.")

# Handle multi-level columns
if df.columns.nlevels > 1:
    df.columns = df.columns.droplevel(1)

# Use Close price
df = df[['Close']].copy()
df.rename(columns={'Close': 'price'}, inplace=True)

print(f"✓ Fetched {len(df)} trading days from {df.index[0].date()} to {df.index[-1].date()}")

# ===========================
# INDICATOR CALCULATION
# ===========================

print(f"\n📈 Calculating indicators (window={ROLL_WINDOW} days)...")

df['roll_mean'] = df['price'].rolling(window=ROLL_WINDOW, min_periods=ROLL_WINDOW).mean()
df['roll_std'] = df['price'].rolling(window=ROLL_WINDOW, min_periods=ROLL_WINDOW).std(ddof=0)
df['z'] = (df['price'] - df['roll_mean']) / df['roll_std']

# Price returns
df['daily_ret'] = df['price'].pct_change()

# Drop initial NaN rows
df = df.dropna().copy()

print(f"✓ Indicators calculated for {len(df)} valid trading days")

# ===========================
# SIGNAL GENERATION
# ===========================

print(f"\n🎯 Generating signals (Z entry=±{Z_ENTRY}, Z exit=±{Z_EXIT})...")

# Signal logic with state machine
signals = []
position_state = 0  # 0=flat, 1=long, -1=short

for i in range(len(df)):
    z_val = df['z'].iat[i]
    
    if position_state == 0:  # Currently flat
        if z_val <= -Z_ENTRY:
            position_state = 1  # Enter long
        elif z_val >= Z_ENTRY:
            position_state = -1  # Enter short
    
    elif position_state == 1:  # Currently long
        if abs(z_val) <= Z_EXIT:
            position_state = 0  # Exit to flat
        elif z_val >= Z_ENTRY:
            position_state = -1  # Flip to short
    
    elif position_state == -1:  # Currently short
        if abs(z_val) <= Z_EXIT:
            position_state = 0  # Exit to flat
        elif z_val <= -Z_ENTRY:
            position_state = 1  # Flip to long
    
    signals.append(position_state)

df['signal'] = signals

# ===========================
# BACKTESTING WITH COMPOUNDING
# ===========================

print(f"\n💰 Running backtest with compounding capital growth...")

# Portfolio tracking
portfolio_value = INITIAL_CAPITAL
cash = INITIAL_CAPITAL
shares = 0.0

# Results storage
portfolio_history = []
trade_log = []

prev_signal = 0

for idx, row in df.iterrows():
    current_price = row['price']
    current_signal = row['signal']
    daily_return = row['daily_ret']
    
    # Calculate current portfolio value
    if shares != 0:
        position_value = shares * current_price
        portfolio_value = cash + position_value
    else:
        portfolio_value = cash
    
    # Check if signal changed (trade event)
    if current_signal != prev_signal:
        # Close existing position
        if shares != 0:
            cash = shares * current_price
            commission = abs(cash) * TRANSACTION_COST
            cash -= commission
            
            trade_log.append({
                'date': idx,
                'action': 'CLOSE',
                'prev_signal': prev_signal,
                'shares': shares,
                'price': current_price,
                'value': abs(shares * current_price),
                'commission': commission,
                'portfolio_value': cash
            })
            
            shares = 0
        
        # Open new position if signal is not flat
        if current_signal != 0:
            # Calculate position size
            max_position_value = portfolio_value * MAX_POSITION_SIZE
            
            if USE_LEVERAGE:
                max_position_value = min(max_position_value, 
                                        portfolio_value * MAX_LEVERAGE)
            else:
                max_position_value = min(max_position_value, cash)
            
            # Calculate shares to buy/short
            shares = (max_position_value / current_price) * current_signal
            
            # Execute trade
            trade_value = shares * current_price
            commission = abs(trade_value) * TRANSACTION_COST
            cash -= (trade_value + commission)
            
            trade_log.append({
                'date': idx,
                'action': 'OPEN',
                'signal': current_signal,
                'shares': shares,
                'price': current_price,
                'value': abs(trade_value),
                'commission': commission,
                'portfolio_value': portfolio_value
            })
    
    # Update portfolio value at end of day
    if shares != 0:
        position_value = shares * current_price
        portfolio_value = cash + position_value
    else:
        portfolio_value = cash
    
    # Record snapshot
    portfolio_history.append({
        'date': idx,
        'price': current_price,
        'z_score': row['z'],
        'signal': current_signal,
        'portfolio_value': portfolio_value,
        'cash': cash,
        'shares': shares,
        'position_value': shares * current_price if shares != 0 else 0,
        'daily_return': (portfolio_value / INITIAL_CAPITAL - 1) if len(portfolio_history) == 0 
                       else (portfolio_value / portfolio_history[-1]['portfolio_value'] - 1)
    })
    
    prev_signal = current_signal

# Convert to DataFrames
portfolio_df = pd.DataFrame(portfolio_history)
trades_df = pd.DataFrame(trade_log) if trade_log else pd.DataFrame()

print(f"✓ Backtest completed: {len(trades_df)} trades executed")

# ===========================
# PERFORMANCE METRICS
# ===========================

print(f"\n📊 Calculating performance metrics...")

# Basic metrics
final_value = portfolio_df['portfolio_value'].iloc[-1]
total_return = (final_value - INITIAL_CAPITAL) / INITIAL_CAPITAL
total_return_pct = total_return * 100

# Annualized metrics
trading_days = len(portfolio_df)
years_traded = trading_days / 252
cagr = (final_value / INITIAL_CAPITAL) ** (1 / years_traded) - 1 if years_traded > 0 else 0

# Risk metrics
daily_returns = portfolio_df['daily_return'].replace([np.inf, -np.inf], np.nan).dropna()
volatility_daily = daily_returns.std()
volatility_annual = volatility_daily * np.sqrt(252)

# Sharpe ratio (assuming 2% risk-free rate)
risk_free_rate = 0.02
excess_return = cagr - risk_free_rate
sharpe_ratio = excess_return / volatility_annual if volatility_annual > 0 else 0

# Drawdown analysis
portfolio_df['cummax'] = portfolio_df['portfolio_value'].cummax()
portfolio_df['drawdown'] = (portfolio_df['portfolio_value'] - portfolio_df['cummax']) / portfolio_df['cummax']
max_drawdown = portfolio_df['drawdown'].min()
max_drawdown_pct = max_drawdown * 100

# Win rate
winning_days = (daily_returns > 0).sum()
win_rate = (winning_days / len(daily_returns) * 100) if len(daily_returns) > 0 else 0

# Trade statistics
if len(trades_df) > 0:
    total_trades = len(trades_df[trades_df['action'] == 'OPEN'])
    total_commissions = trades_df['commission'].sum()
else:
    total_trades = 0
    total_commissions = 0

# Buy & Hold comparison
buy_hold_return = (df['price'].iloc[-1] - df['price'].iloc[0]) / df['price'].iloc[0]
buy_hold_pct = buy_hold_return * 100

# Calculate signal-based statistics
long_days = (portfolio_df['signal'] == 1).sum()
short_days = (portfolio_df['signal'] == -1).sum()
flat_days = (portfolio_df['signal'] == 0).sum()

# ===========================
# RESULTS DISPLAY
# ===========================

print("\n" + "="*80)
print("PERFORMANCE SUMMARY")
print("="*80)

print(f"\n📊 STRATEGY PARAMETERS:")
print(f"  • Ticker:                  {TICKER}")
print(f"  • Period:                  {portfolio_df['date'].iloc[0].date()} to {portfolio_df['date'].iloc[-1].date()}")
print(f"  • Trading Days:            {trading_days:,}")
print(f"  • Years:                   {years_traded:.1f}")
print(f"  • Rolling Window:          {ROLL_WINDOW} days")
print(f"  • Z-Score Entry:           ±{Z_ENTRY}")
print(f"  • Z-Score Exit:            ±{Z_EXIT}")
print(f"  • Initial Capital:         ${INITIAL_CAPITAL:,.2f}")
print(f"  • Max Position Size:       {MAX_POSITION_SIZE*100:.0f}%")
print(f"  • Transaction Cost:        {TRANSACTION_COST*100:.2f}%")

print(f"\n💰 CAPITAL GROWTH:")
print(f"  • Initial Capital:         ${INITIAL_CAPITAL:,.2f}")
print(f"  • Final Portfolio Value:   ${final_value:,.2f}")
print(f"  • Total Return:            {total_return_pct:+.2f}%")
print(f"  • CAGR:                    {cagr*100:.2f}%")
print(f"  • Total Profit/Loss:       ${final_value - INITIAL_CAPITAL:+,.2f}")

print(f"\n📈 RISK METRICS:")
print(f"  • Annualized Volatility:   {volatility_annual*100:.2f}%")
print(f"  • Sharpe Ratio:            {sharpe_ratio:.2f}")
print(f"  • Max Drawdown:            {max_drawdown_pct:.2f}%")
print(f"  • Win Rate:                {win_rate:.2f}%")

print(f"\n🎯 TRADING ACTIVITY:")
print(f"  • Total Trades:            {total_trades}")
print(f"  • Total Commissions:       ${total_commissions:,.2f}")
print(f"  • Avg Trades/Year:         {total_trades/years_traded:.1f}")
print(f"  • Long Days:               {long_days} ({long_days/trading_days*100:.1f}%)")
print(f"  • Short Days:              {short_days} ({short_days/trading_days*100:.1f}%)")
print(f"  • Flat Days:               {flat_days} ({flat_days/trading_days*100:.1f}%)")

print(f"\n📊 BENCHMARK COMPARISON:")
print(f"  • Buy & Hold Return:       {buy_hold_pct:+.2f}%")
print(f"  • Strategy Outperformance: {total_return_pct - buy_hold_pct:+.2f}%")
print(f"  • Strategy / B&H Ratio:    {total_return / buy_hold_return:.2f}x")

print("\n" + "="*80)

# ===========================
# VISUALIZATION
# ===========================

print(f"\n📊 Generating performance charts...")

fig = plt.figure(figsize=(16, 12))

# 1. Portfolio Value Growth
ax1 = plt.subplot(4, 1, 1)
ax1.plot(portfolio_df['date'], portfolio_df['portfolio_value'], 
         label='Strategy Portfolio', color='darkblue', linewidth=2)
ax1.axhline(y=INITIAL_CAPITAL, color='red', linestyle='--', 
           label='Initial Capital', alpha=0.7)

# Buy & Hold comparison
buy_hold_curve = INITIAL_CAPITAL * (df['price'] / df['price'].iloc[0])
ax1.plot(df.index, buy_hold_curve, label='Buy & Hold', 
         color='orange', linewidth=1.5, alpha=0.7)

ax1.set_ylabel('Portfolio Value ($)', fontsize=11, fontweight='bold')
ax1.set_title('Portfolio Performance - Capital Growth with Compounding', 
             fontsize=13, fontweight='bold')
ax1.legend(loc='upper left')
ax1.grid(True, alpha=0.3)
ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x:,.0f}'))

# 2. Price and Z-Score
ax2 = plt.subplot(4, 1, 2)
ax2_twin = ax2.twinx()

ax2.plot(df.index, df['price'], label='Price', color='black', linewidth=1.5)
ax2.set_ylabel('Price', fontsize=11, fontweight='bold', color='black')
ax2.tick_params(axis='y', labelcolor='black')

ax2_twin.plot(portfolio_df['date'], portfolio_df['z_score'], 
             label='Z-Score', color='purple', linewidth=2, alpha=0.7)
ax2_twin.axhline(y=Z_ENTRY, color='red', linestyle='--', alpha=0.5, label='Entry Threshold')
ax2_twin.axhline(y=-Z_ENTRY, color='green', linestyle='--', alpha=0.5)
ax2_twin.axhline(y=Z_EXIT, color='orange', linestyle=':', alpha=0.5, label='Exit Threshold')
ax2_twin.axhline(y=-Z_EXIT, color='orange', linestyle=':', alpha=0.5)
ax2_twin.axhline(y=0, color='gray', linestyle='-', alpha=0.3)
ax2_twin.set_ylabel('Z-Score', fontsize=11, fontweight='bold', color='purple')
ax2_twin.tick_params(axis='y', labelcolor='purple')

ax2.set_title('Price & Mean Reversion Signals', fontsize=13, fontweight='bold')
ax2.grid(True, alpha=0.3)

lines1, labels1 = ax2.get_legend_handles_labels()
lines2, labels2 = ax2_twin.get_legend_handles_labels()
ax2.legend(lines1 + lines2, labels1 + labels2, loc='upper left')

# 3. Position Exposure
ax3 = plt.subplot(4, 1, 3)
position_pct = (portfolio_df['position_value'] / portfolio_df['portfolio_value']) * 100

# Color code by signal
colors = ['green' if s == 1 else 'red' if s == -1 else 'gray' 
          for s in portfolio_df['signal']]
ax3.bar(portfolio_df['date'], position_pct, color=colors, alpha=0.6, width=1)
ax3.axhline(y=0, color='black', linewidth=0.5)
ax3.set_ylabel('Position Exposure (%)', fontsize=11, fontweight='bold')
ax3.set_title('Position Sizing (Green=Long, Red=Short, Gray=Flat)', 
             fontsize=13, fontweight='bold')
ax3.grid(True, alpha=0.3, axis='y')

# 4. Drawdown
ax4 = plt.subplot(4, 1, 4)
ax4.fill_between(portfolio_df['date'], 0, portfolio_df['drawdown'] * 100, 
                 color='red', alpha=0.5)
ax4.set_ylabel('Drawdown (%)', fontsize=11, fontweight='bold')
ax4.set_xlabel('Date', fontsize=11, fontweight='bold')
ax4.set_title('Drawdown Analysis', fontsize=13, fontweight='bold')
ax4.grid(True, alpha=0.3)

plt.tight_layout()

# Save figure
filename = f"mean_reversion_capital_growth_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
plt.savefig(filename, dpi=300, bbox_inches='tight')
print(f"✓ Chart saved to: {filename}")

plt.show()

# ===========================
# EXPORT DATA
# ===========================

print(f"\n💾 Exporting results...")

# Export portfolio history
portfolio_filename = f"portfolio_history_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
portfolio_df.to_csv(portfolio_filename, index=False)
print(f"✓ Portfolio history: {portfolio_filename}")

# Export trade log
if len(trades_df) > 0:
    trades_filename = f"trade_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    trades_df.to_csv(trades_filename, index=False)
    print(f"✓ Trade log: {trades_filename}")

print("\n" + "="*80)
print("✅ STRATEGY EXECUTION COMPLETED!")
print("="*80 + "\n")


