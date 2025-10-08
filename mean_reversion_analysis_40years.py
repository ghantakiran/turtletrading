import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime, timedelta

# ----------------------
# Parameters (tweakable)
# ----------------------
TICKER = "^GSPC"            # S&P 500 index (swap if you prefer another asset)
YEARS = 40                  # how many years back to fetch
ROLL_WINDOW = 20            # rolling window for mean/std (days)
Z_ENTRY = 2.0               # z-score threshold to enter (abs)
Z_EXIT = 0.25               # close when z reverts to this magnitude
TRANSACTION_COST = 0.000   # fraction (e.g., 0.001 = 0.1%) per trade round-trip approximation
START_DATE = (datetime.now() - pd.DateOffset(years=YEARS)).strftime("%Y-%m-%d")
END_DATE = datetime.now().strftime("%Y-%m-%d")

# ----------------------
# Fetch data
# ----------------------
df = yf.download(TICKER, start=START_DATE, end=END_DATE, progress=False)
if df.empty:
    raise SystemExit("Downloaded data is empty — check ticker or internet connection.")

# Handle multi-level columns if present
if df.columns.nlevels > 1:
    df.columns = df.columns.droplevel(1)

# Use Close price
df = df[['Close']].copy()
df.rename(columns={'Close': 'price'}, inplace=True)

# ----------------------
# Compute indicators
# ----------------------
df['roll_mean'] = df['price'].rolling(window=ROLL_WINDOW, min_periods=ROLL_WINDOW).mean()
df['roll_std']  = df['price'].rolling(window=ROLL_WINDOW, min_periods=ROLL_WINDOW).std(ddof=0)
df['z'] = (df['price'] - df['roll_mean']) / df['roll_std']

# Next-day forward return (percentage)
df['next_price'] = df['price'].shift(-1)
df['next_ret'] = df['next_price'] / df['price'] - 1.0

# Drop rows with NaN indicators
df = df.dropna().copy()

# ----------------------
# Signal generation (simple entry/exit)
# ----------------------
# We'll create a daily position series: 1 for long, -1 for short, 0 for flat.
pos = np.zeros(len(df), dtype=int)

# Simple rule:
# if z < -Z_ENTRY -> set position = +1 (long next day)
# if z > +Z_ENTRY -> set position = -1 (short next day)
# optionally we can keep position until z crosses Z_EXIT toward zero (exit).
in_trade = 0
for i in range(len(df)):
    z_i = df['z'].iat[i]
    if in_trade == 0:
        if z_i <= -Z_ENTRY:
            in_trade = 1
        elif z_i >= Z_ENTRY:
            in_trade = -1
    else:
        # exit when |z| <= Z_EXIT or when z crosses sign beyond entry threshold
        if abs(z_i) <= Z_EXIT:
            in_trade = 0
        # (optionally) flip if opposite extreme encountered:
        elif in_trade == 1 and z_i >= Z_ENTRY:
            in_trade = -1
        elif in_trade == -1 and z_i <= -Z_ENTRY:
            in_trade = 1
    pos[i] = in_trade

df['position'] = pos

# The position applies for the *next* day's return (we generate signal based on today's z to trade next day)
# So strategy return on day i is position[i-1] * next_ret[i-1], but simpler: align by shifting position forward:
df['position_nextday'] = df['position'].shift(0)  # position decided at end of today to be used for next day's open->close return
# We'll assume we get close-to-close next_ret as approximation of next day's performance.
df['strategy_ret'] = df['position_nextday'] * df['next_ret']

# Transaction costs: charge cost whenever position changes (entry or flip)
df['pos_change'] = df['position_nextday'].diff().fillna(0).abs()
# Approx cost per change (we'll approximate as TRANSACTION_COST * abs(change))
df['strategy_ret_after_cost'] = df['strategy_ret'] - df['pos_change'] * TRANSACTION_COST

# Cumulative returns
df['cum_strategy'] = (1 + df['strategy_ret_after_cost']).cumprod()
df['cum_buy_hold'] = (1 + df['next_ret']).cumprod()

# ----------------------
# Metrics: next-day performance after signals
# ----------------------
# Gather next-day returns where we had long or short signals
long_mask = df['position'] == 1
short_mask = df['position'] == -1
flat_mask = df['position'] == 0

def summarize(mask):
    n = mask.sum()
    if n == 0:
        return {"n":0}
    mean_next = df.loc[mask, 'next_ret'].mean()
    median_next = df.loc[mask, 'next_ret'].median()
    win_rate = (df.loc[mask, 'next_ret'] > 0).mean()
    cum = (1 + df.loc[mask, 'next_ret']).prod() - 1
    return {"n": int(n), "mean_next": float(mean_next), "median_next": float(median_next),
            "win_rate": float(win_rate), "cum_return": float(cum)}

summary_long = summarize(long_mask)
summary_short = summarize(short_mask)
summary_all = summarize(df['position'] != 0)

# Strategy-level metrics
total_days = len(df)
trades = int((df['pos_change'] > 0).sum())  # number of changes (approx twice entries/exits)
final_cum = df['cum_strategy'].iat[-1] if not df['cum_strategy'].isna().all() else np.nan
bh_cum = df['cum_buy_hold'].iat[-1]

# Simple Sharpe-like metric on strategy daily returns (annualized)
daily_ret = df['strategy_ret_after_cost'].replace([np.inf, -np.inf], np.nan).dropna()
sharpe = None
if len(daily_ret) > 1:
    sharpe = (daily_ret.mean() / daily_ret.std()) * np.sqrt(252)

# ----------------------
# Print results
# ----------------------
print("=== Mean Reversion Next-Day Test ===")
print(f"Ticker: {TICKER}")
print(f"Date range: {df.index[0].date()} to {df.index[-1].date()} ({total_days} trading days)")
print(f"Rolling window = {ROLL_WINDOW} days, Z entry = {Z_ENTRY}, Z exit = {Z_EXIT}")
print()
print("Long signals (z <= -entry):", summary_long)
print("Short signals (z >= +entry):", summary_short)
print("All signals:", summary_all)
print()
print(f"Approx. trade events (pos changes): {trades}")
print(f"Final cumulative strategy multiplier: {final_cum:.4f}  (equivalent return {final_cum-1:.2%})")
print(f"Cumulative buy-and-hold multiplier: {bh_cum:.4f}  (equivalent return {bh_cum-1:.2%})")
if sharpe is not None:
    print(f"Strategy daily Sharpe (annualized approx): {sharpe:.2f}")
print()
print("Note: next-day returns are close-to-close proxy; real execution might differ due to gaps/slippage.")

# ----------------------
# Plots
# ----------------------
plt.figure(figsize=(12, 8))
plt.subplot(3,1,1)
plt.plot(df.index, df['price'], label='Price')
plt.plot(df.index, df['roll_mean'], label=f'{ROLL_WINDOW}-day MA')
plt.title(f"{TICKER} Price and Rolling Mean")
plt.legend()

plt.subplot(3,1,2)
plt.plot(df.index, df['z'], label='z-score')
plt.axhline(Z_ENTRY, color='r', linestyle='--', label='Z entry')
plt.axhline(-Z_ENTRY, color='g', linestyle='--')
plt.axhline(Z_EXIT, color='k', linestyle=':', label='Z exit')
plt.legend()
plt.title('Z-score')

plt.subplot(3,1,3)
plt.plot(df.index, df['cum_buy_hold'], label='Buy & Hold (close->close)')
plt.plot(df.index, df['cum_strategy'], label='Mean-Reversion Strategy')
plt.legend()
plt.title('Cumulative Returns (multiplier)')
plt.tight_layout()
plt.savefig('mean_reversion_40years_analysis.png', dpi=300, bbox_inches='tight')
print("\nChart saved to: mean_reversion_40years_analysis.png")
plt.show()

