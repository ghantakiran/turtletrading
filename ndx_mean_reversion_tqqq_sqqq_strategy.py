"""
NDX Mean Reversion Strategy with TQQQ/SQQQ Portfolio
=====================================================

This strategy implements mean reversion on NDX (NASDAQ-100 Index) and trades:
- TQQQ (3x leveraged long NDX ETF) for BUY signals
- SQQQ (3x leveraged short NDX ETF) for SELL signals

Portfolio: $10,000 starting capital
Daily rebalancing based on z-score deviation from mean

Author: TurtleTrading Platform
Date: October 2025
"""

import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

from loguru import logger
import sys

# Configure logger
logger.remove()
logger.add(sys.stdout, level="INFO", colorize=True, 
          format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{message}</cyan>")


class NDXMeanReversionStrategy:
    """
    Mean Reversion Strategy for NDX trading TQQQ/SQQQ
    
    Strategy Logic:
    1. Calculate NDX rolling mean and standard deviation (20-day lookback)
    2. Compute z-score: (current_price - mean) / std_dev
    3. Generate signals:
       - z < -1.5: Strong BUY → Buy TQQQ, Sell SQQQ
       - -1.5 < z < -0.5: Weak BUY → Buy TQQQ (70%), Sell SQQQ (30%)
       - -0.5 < z < 0.5: NEUTRAL → 50% TQQQ, 50% SQQQ
       - 0.5 < z < 1.5: Weak SELL → Sell TQQQ (30%), Buy SQQQ (70%)
       - z > 1.5: Strong SELL → Sell TQQQ, Buy SQQQ
    4. Daily rebalance portfolio based on signals
    """
    
    def __init__(
        self,
        initial_capital: float = 10000.0,
        lookback_period: int = 20,
        entry_z_score: float = 1.5,
        exit_z_score: float = 0.5,
        commission_pct: float = 0.001,  # 0.1% commission
        start_date: str = "2020-01-01",
        end_date: Optional[str] = None
    ):
        """
        Initialize the Mean Reversion Strategy
        
        Args:
            initial_capital: Starting portfolio value ($)
            lookback_period: Days to calculate rolling mean/std
            entry_z_score: Z-score threshold for entry signals
            exit_z_score: Z-score threshold for exit signals
            commission_pct: Trading commission as percentage
            start_date: Strategy start date (YYYY-MM-DD)
            end_date: Strategy end date (YYYY-MM-DD), defaults to today
        """
        self.initial_capital = initial_capital
        self.lookback_period = lookback_period
        self.entry_z_score = entry_z_score
        self.exit_z_score = exit_z_score
        self.commission_pct = commission_pct
        self.start_date = start_date
        self.end_date = end_date or datetime.now().strftime("%Y-%m-%d")
        
        # Portfolio tracking
        self.portfolio_value = initial_capital
        self.cash = initial_capital
        self.tqqq_shares = 0.0
        self.sqqq_shares = 0.0
        
        # Data storage
        self.ndx_data = None
        self.tqqq_data = None
        self.sqqq_data = None
        self.signals_df = None
        self.portfolio_history = []
        self.trade_log = []
        
    def fetch_data(self) -> bool:
        """
        Fetch historical price data for NDX, TQQQ, and SQQQ
        
        Note: TQQQ/SQQQ launched in Feb 2010, so backtest starts from then
        but we fetch NDX data from start_date for better signal calculation
        
        Returns:
            True if data fetched successfully, False otherwise
        """
        try:
            logger.info(f"Fetching NDX data from {self.start_date} to {self.end_date}...")
            logger.info("Note: TQQQ/SQQQ launched in 2010, backtest will start from 2010-02-11")
            
            # Fetch NDX (using QQQ as proxy since ^NDX may have data issues)
            logger.info("Fetching NDX data (using ^NDX)...")
            ndx = yf.download("^NDX", start=self.start_date, end=self.end_date, progress=False)
            
            # If NDX data is insufficient, use QQQ as backup
            if ndx.empty or len(ndx) < self.lookback_period:
                logger.warning("NDX data insufficient, using QQQ as proxy...")
                ndx = yf.download("QQQ", start=self.start_date, end=self.end_date, progress=False)
            
            if ndx.empty:
                logger.error("Failed to fetch NDX/QQQ data")
                return False
            
            logger.info(f"NDX data: {len(ndx)} days from {ndx.index[0].date()} to {ndx.index[-1].date()}")
            
            # Fetch TQQQ (launched 2010-02-11)
            logger.info("Fetching TQQQ data...")
            tqqq = yf.download("TQQQ", start="2010-02-11", end=self.end_date, progress=False)
            if tqqq.empty:
                logger.error("Failed to fetch TQQQ data")
                return False
            
            logger.info(f"TQQQ data: {len(tqqq)} days from {tqqq.index[0].date()} to {tqqq.index[-1].date()}")
            
            # Fetch SQQQ (launched 2010-02-11)
            logger.info("Fetching SQQQ data...")
            sqqq = yf.download("SQQQ", start="2010-02-11", end=self.end_date, progress=False)
            if sqqq.empty:
                logger.error("Failed to fetch SQQQ data")
                return False
            
            logger.info(f"SQQQ data: {len(sqqq)} days from {sqqq.index[0].date()} to {sqqq.index[-1].date()}")
            
            # Store data
            self.ndx_data = ndx['Close'] if 'Close' in ndx.columns else ndx['Adj Close']
            self.tqqq_data = tqqq['Close'] if 'Close' in tqqq.columns else tqqq['Adj Close']
            self.sqqq_data = sqqq['Close'] if 'Close' in sqqq.columns else sqqq['Adj Close']
            
            # Align all data to the same dates (intersection)
            # This will effectively start from when TQQQ/SQQQ are available
            common_dates = self.ndx_data.index.intersection(
                self.tqqq_data.index
            ).intersection(self.sqqq_data.index)
            
            if len(common_dates) == 0:
                logger.error("No overlapping dates between NDX, TQQQ, and SQQQ")
                return False
            
            self.ndx_data = self.ndx_data.loc[common_dates]
            self.tqqq_data = self.tqqq_data.loc[common_dates]
            self.sqqq_data = self.sqqq_data.loc[common_dates]
            
            logger.info(f"✓ Data aligned: {len(self.ndx_data)} trading days")
            logger.info(f"✓ Backtest period: {self.ndx_data.index[0].date()} to {self.ndx_data.index[-1].date()}")
            
            # Calculate actual years covered
            days_covered = (self.ndx_data.index[-1] - self.ndx_data.index[0]).days
            years_covered = days_covered / 365.25
            logger.info(f"✓ Coverage: {years_covered:.1f} years ({days_covered} calendar days)")
            
            return True
            
        except Exception as e:
            logger.error(f"Error fetching data: {e}")
            return False
    
    def calculate_signals(self) -> pd.DataFrame:
        """
        Calculate mean reversion signals based on NDX z-score
        
        Returns:
            DataFrame with signals and portfolio allocations
        """
        logger.info("Calculating mean reversion signals...")
        
        # Calculate rolling statistics
        df = pd.DataFrame(index=self.ndx_data.index)
        df['ndx_price'] = self.ndx_data.values
        df['tqqq_price'] = self.tqqq_data.values
        df['sqqq_price'] = self.sqqq_data.values
        
        # Rolling mean and standard deviation
        df['rolling_mean'] = df['ndx_price'].rolling(window=self.lookback_period).mean()
        df['rolling_std'] = df['ndx_price'].rolling(window=self.lookback_period).std()
        
        # Z-score calculation
        df['z_score'] = (df['ndx_price'] - df['rolling_mean']) / df['rolling_std']
        
        # Signal generation based on z-score
        def generate_allocation(z: float) -> Tuple[float, float]:
            """
            Generate TQQQ/SQQQ allocation based on z-score
            
            Returns:
                (tqqq_allocation, sqqq_allocation) as percentages (0-1)
            """
            if pd.isna(z):
                return 0.5, 0.5  # Neutral if no signal
            
            if z <= -self.entry_z_score:  # Strong BUY (price far below mean)
                return 1.0, 0.0  # 100% TQQQ
            elif -self.entry_z_score < z <= -self.exit_z_score:  # Weak BUY
                # Linear interpolation between 70-100% TQQQ
                tqqq_pct = 0.7 + 0.3 * ((-z - self.exit_z_score) / (self.entry_z_score - self.exit_z_score))
                return tqqq_pct, 1.0 - tqqq_pct
            elif -self.exit_z_score < z < self.exit_z_score:  # NEUTRAL
                return 0.5, 0.5  # 50/50 split
            elif self.exit_z_score <= z < self.entry_z_score:  # Weak SELL
                # Linear interpolation between 30-0% TQQQ
                tqqq_pct = 0.3 * (1 - (z - self.exit_z_score) / (self.entry_z_score - self.exit_z_score))
                return tqqq_pct, 1.0 - tqqq_pct
            else:  # z >= entry_z_score - Strong SELL (price far above mean)
                return 0.0, 1.0  # 100% SQQQ
        
        # Apply allocation logic
        df[['tqqq_target_pct', 'sqqq_target_pct']] = df['z_score'].apply(
            lambda z: pd.Series(generate_allocation(z))
        )
        
        # Signal classification for logging
        def classify_signal(z: float) -> str:
            if pd.isna(z):
                return 'NEUTRAL'
            elif z <= -self.entry_z_score:
                return 'STRONG_BUY'
            elif -self.entry_z_score < z <= -self.exit_z_score:
                return 'WEAK_BUY'
            elif -self.exit_z_score < z < self.exit_z_score:
                return 'NEUTRAL'
            elif self.exit_z_score <= z < self.entry_z_score:
                return 'WEAK_SELL'
            else:
                return 'STRONG_SELL'
        
        df['signal'] = df['z_score'].apply(classify_signal)
        
        # Drop rows with insufficient data
        df = df.dropna(subset=['rolling_mean', 'rolling_std', 'z_score'])
        
        self.signals_df = df
        logger.info(f"Signals calculated for {len(df)} days")
        
        return df
    
    def backtest(self) -> Dict:
        """
        Run the backtest simulation with daily rebalancing
        
        Returns:
            Dictionary with backtest results and performance metrics
        """
        if self.signals_df is None:
            logger.error("Signals not calculated. Run calculate_signals() first.")
            return {}
        
        logger.info("Running backtest simulation...")
        
        # Reset portfolio
        self.portfolio_value = self.initial_capital
        self.cash = self.initial_capital
        self.tqqq_shares = 0.0
        self.sqqq_shares = 0.0
        self.portfolio_history = []
        self.trade_log = []
        
        # Iterate through each trading day
        for date, row in self.signals_df.iterrows():
            # Current prices
            tqqq_price = row['tqqq_price']
            sqqq_price = row['sqqq_price']
            
            # Current portfolio value before rebalancing
            current_tqqq_value = self.tqqq_shares * tqqq_price
            current_sqqq_value = self.sqqq_shares * sqqq_price
            self.portfolio_value = self.cash + current_tqqq_value + current_sqqq_value
            
            # Target allocations
            target_tqqq_value = self.portfolio_value * row['tqqq_target_pct']
            target_sqqq_value = self.portfolio_value * row['sqqq_target_pct']
            
            # Calculate required trades
            tqqq_value_change = target_tqqq_value - current_tqqq_value
            sqqq_value_change = target_sqqq_value - current_sqqq_value
            
            # Execute trades
            trades_executed = []
            
            # Trade TQQQ
            if abs(tqqq_value_change) > 1.0:  # Only trade if change > $1
                tqqq_shares_change = tqqq_value_change / tqqq_price
                commission = abs(tqqq_value_change) * self.commission_pct
                
                self.tqqq_shares += tqqq_shares_change
                self.cash -= (tqqq_value_change + commission)
                
                trades_executed.append({
                    'date': date,
                    'symbol': 'TQQQ',
                    'action': 'BUY' if tqqq_shares_change > 0 else 'SELL',
                    'shares': abs(tqqq_shares_change),
                    'price': tqqq_price,
                    'value': abs(tqqq_value_change),
                    'commission': commission
                })
            
            # Trade SQQQ
            if abs(sqqq_value_change) > 1.0:  # Only trade if change > $1
                sqqq_shares_change = sqqq_value_change / sqqq_price
                commission = abs(sqqq_value_change) * self.commission_pct
                
                self.sqqq_shares += sqqq_shares_change
                self.cash -= (sqqq_value_change + commission)
                
                trades_executed.append({
                    'date': date,
                    'symbol': 'SQQQ',
                    'action': 'BUY' if sqqq_shares_change > 0 else 'SELL',
                    'shares': abs(sqqq_shares_change),
                    'price': sqqq_price,
                    'value': abs(sqqq_value_change),
                    'commission': commission
                })
            
            # Recalculate portfolio value after trades
            self.portfolio_value = (
                self.cash + 
                self.tqqq_shares * tqqq_price + 
                self.sqqq_shares * sqqq_price
            )
            
            # Log trades
            self.trade_log.extend(trades_executed)
            
            # Record portfolio snapshot
            self.portfolio_history.append({
                'date': date,
                'portfolio_value': self.portfolio_value,
                'cash': self.cash,
                'tqqq_shares': self.tqqq_shares,
                'tqqq_value': self.tqqq_shares * tqqq_price,
                'sqqq_shares': self.sqqq_shares,
                'sqqq_value': self.sqqq_shares * sqqq_price,
                'tqqq_allocation': (self.tqqq_shares * tqqq_price) / self.portfolio_value,
                'sqqq_allocation': (self.sqqq_shares * sqqq_price) / self.portfolio_value,
                'z_score': row['z_score'],
                'signal': row['signal'],
                'ndx_price': row['ndx_price']
            })
        
        logger.info(f"Backtest completed: {len(self.trade_log)} trades executed")
        
        # Calculate performance metrics
        return self.calculate_performance_metrics()
    
    def calculate_performance_metrics(self) -> Dict:
        """
        Calculate comprehensive performance metrics
        
        Returns:
            Dictionary with performance statistics
        """
        if not self.portfolio_history:
            logger.error("No portfolio history available")
            return {}
        
        df = pd.DataFrame(self.portfolio_history)
        
        # Basic metrics
        final_value = df['portfolio_value'].iloc[-1]
        total_return = (final_value - self.initial_capital) / self.initial_capital
        total_return_pct = total_return * 100
        
        # Daily returns
        df['daily_return'] = df['portfolio_value'].pct_change()
        
        # Annualized metrics
        trading_days = len(df)
        years = trading_days / 252
        cagr = (final_value / self.initial_capital) ** (1 / years) - 1 if years > 0 else 0
        
        # Risk metrics
        daily_returns = df['daily_return'].dropna()
        volatility_daily = daily_returns.std()
        volatility_annual = volatility_daily * np.sqrt(252)
        
        # Sharpe ratio (assuming 2% risk-free rate)
        risk_free_rate = 0.02
        excess_return = cagr - risk_free_rate
        sharpe_ratio = excess_return / volatility_annual if volatility_annual > 0 else 0
        
        # Drawdown analysis
        df['cumulative_max'] = df['portfolio_value'].cummax()
        df['drawdown'] = (df['portfolio_value'] - df['cumulative_max']) / df['cumulative_max']
        max_drawdown = df['drawdown'].min()
        max_drawdown_pct = max_drawdown * 100
        
        # Win rate
        winning_days = (daily_returns > 0).sum()
        total_days = len(daily_returns)
        win_rate = (winning_days / total_days * 100) if total_days > 0 else 0
        
        # Trade statistics
        total_trades = len(self.trade_log)
        total_commissions = sum(trade['commission'] for trade in self.trade_log)
        
        # Buy/Hold comparison (using TQQQ)
        if len(self.signals_df) > 0:
            tqqq_buy_hold_return = (
                (self.signals_df['tqqq_price'].iloc[-1] - self.signals_df['tqqq_price'].iloc[0]) / 
                self.signals_df['tqqq_price'].iloc[0]
            )
            tqqq_buy_hold_pct = tqqq_buy_hold_return * 100
        else:
            tqqq_buy_hold_pct = 0
        
        results = {
            'initial_capital': self.initial_capital,
            'final_value': final_value,
            'total_return_pct': total_return_pct,
            'cagr_pct': cagr * 100,
            'volatility_annual_pct': volatility_annual * 100,
            'sharpe_ratio': sharpe_ratio,
            'max_drawdown_pct': max_drawdown_pct,
            'win_rate_pct': win_rate,
            'total_trades': total_trades,
            'total_commissions': total_commissions,
            'trading_days': trading_days,
            'tqqq_buy_hold_pct': tqqq_buy_hold_pct,
            'outperformance_vs_tqqq': total_return_pct - tqqq_buy_hold_pct
        }
        
        return results
    
    def print_results(self, results: Dict):
        """
        Print formatted backtest results
        
        Args:
            results: Dictionary with performance metrics
        """
        print("\n" + "="*80)
        print("NDX MEAN REVERSION STRATEGY - TQQQ/SQQQ PORTFOLIO")
        print("="*80)
        print(f"\n📊 STRATEGY PARAMETERS:")
        print(f"  • Initial Capital:        ${results['initial_capital']:,.2f}")
        print(f"  • Lookback Period:        {self.lookback_period} days")
        print(f"  • Entry Z-Score:          ±{self.entry_z_score}")
        print(f"  • Exit Z-Score:           ±{self.exit_z_score}")
        print(f"  • Commission:             {self.commission_pct*100:.2f}%")
        print(f"  • Period:                 {self.start_date} to {self.end_date}")
        
        print(f"\n💰 PERFORMANCE SUMMARY:")
        print(f"  • Final Portfolio Value:  ${results['final_value']:,.2f}")
        print(f"  • Total Return:           {results['total_return_pct']:+.2f}%")
        print(f"  • CAGR:                   {results['cagr_pct']:.2f}%")
        print(f"  • Annualized Volatility:  {results['volatility_annual_pct']:.2f}%")
        print(f"  • Sharpe Ratio:           {results['sharpe_ratio']:.2f}")
        print(f"  • Max Drawdown:           {results['max_drawdown_pct']:.2f}%")
        print(f"  • Win Rate:               {results['win_rate_pct']:.2f}%")
        
        print(f"\n📈 BENCHMARK COMPARISON:")
        print(f"  • TQQQ Buy & Hold Return: {results['tqqq_buy_hold_pct']:+.2f}%")
        print(f"  • Strategy Outperformance:{results['outperformance_vs_tqqq']:+.2f}%")
        
        print(f"\n🔄 TRADING ACTIVITY:")
        print(f"  • Total Trades:           {results['total_trades']}")
        print(f"  • Trading Days:           {results['trading_days']}")
        print(f"  • Total Commissions:      ${results['total_commissions']:,.2f}")
        print(f"  • Avg Trades per Day:     {results['total_trades']/results['trading_days']:.2f}")
        
        print("\n" + "="*80 + "\n")
    
    def plot_results(self):
        """
        Create comprehensive visualization of backtest results
        """
        if not self.portfolio_history:
            logger.error("No portfolio history to plot")
            return
        
        df = pd.DataFrame(self.portfolio_history)
        
        # Create figure with subplots
        fig, axes = plt.subplots(4, 1, figsize=(16, 12))
        fig.suptitle('NDX Mean Reversion Strategy - TQQQ/SQQQ Portfolio Analysis', 
                    fontsize=16, fontweight='bold')
        
        # 1. Portfolio Value Over Time
        ax1 = axes[0]
        ax1.plot(df['date'], df['portfolio_value'], label='Strategy Portfolio', 
                color='darkblue', linewidth=2)
        ax1.axhline(y=self.initial_capital, color='red', linestyle='--', 
                   label='Initial Capital', alpha=0.7)
        
        # Calculate TQQQ buy & hold for comparison
        tqqq_buy_hold = self.initial_capital * (self.signals_df['tqqq_price'] / 
                                                self.signals_df['tqqq_price'].iloc[0])
        ax1.plot(tqqq_buy_hold.index, tqqq_buy_hold.values, 
                label='TQQQ Buy & Hold', color='orange', linewidth=1.5, alpha=0.7)
        
        ax1.set_ylabel('Portfolio Value ($)', fontsize=12, fontweight='bold')
        ax1.set_title('Portfolio Performance', fontsize=13, fontweight='bold')
        ax1.legend(loc='upper left')
        ax1.grid(True, alpha=0.3)
        ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x:,.0f}'))
        
        # 2. NDX Price and Z-Score
        ax2 = axes[1]
        ax2_twin = ax2.twinx()
        
        ax2.plot(df['date'], df['ndx_price'], label='NDX Price', color='black', linewidth=1.5)
        ax2.set_ylabel('NDX Price', fontsize=12, fontweight='bold', color='black')
        ax2.tick_params(axis='y', labelcolor='black')
        
        ax2_twin.plot(df['date'], df['z_score'], label='Z-Score', color='purple', linewidth=2)
        ax2_twin.axhline(y=self.entry_z_score, color='red', linestyle='--', 
                        alpha=0.5, label='Entry Threshold')
        ax2_twin.axhline(y=-self.entry_z_score, color='green', linestyle='--', 
                        alpha=0.5)
        ax2_twin.axhline(y=self.exit_z_score, color='orange', linestyle=':', 
                        alpha=0.5, label='Exit Threshold')
        ax2_twin.axhline(y=-self.exit_z_score, color='orange', linestyle=':', alpha=0.5)
        ax2_twin.axhline(y=0, color='gray', linestyle='-', alpha=0.3)
        ax2_twin.set_ylabel('Z-Score', fontsize=12, fontweight='bold', color='purple')
        ax2_twin.tick_params(axis='y', labelcolor='purple')
        
        ax2.set_title('NDX Price & Mean Reversion Z-Score', fontsize=13, fontweight='bold')
        ax2.grid(True, alpha=0.3)
        
        lines1, labels1 = ax2.get_legend_handles_labels()
        lines2, labels2 = ax2_twin.get_legend_handles_labels()
        ax2.legend(lines1 + lines2, labels1 + labels2, loc='upper left')
        
        # 3. Portfolio Allocation
        ax3 = axes[2]
        ax3.fill_between(df['date'], 0, df['tqqq_allocation'] * 100, 
                         label='TQQQ %', color='green', alpha=0.6)
        ax3.fill_between(df['date'], df['tqqq_allocation'] * 100, 100, 
                         label='SQQQ %', color='red', alpha=0.6)
        ax3.set_ylabel('Allocation (%)', fontsize=12, fontweight='bold')
        ax3.set_title('Portfolio Allocation (TQQQ vs SQQQ)', fontsize=13, fontweight='bold')
        ax3.legend(loc='upper right')
        ax3.set_ylim([0, 100])
        ax3.grid(True, alpha=0.3)
        
        # 4. Drawdown
        ax4 = axes[3]
        df['cumulative_max'] = df['portfolio_value'].cummax()
        df['drawdown_pct'] = (df['portfolio_value'] - df['cumulative_max']) / df['cumulative_max'] * 100
        ax4.fill_between(df['date'], 0, df['drawdown_pct'], color='red', alpha=0.5)
        ax4.set_ylabel('Drawdown (%)', fontsize=12, fontweight='bold')
        ax4.set_xlabel('Date', fontsize=12, fontweight='bold')
        ax4.set_title('Drawdown Analysis', fontsize=13, fontweight='bold')
        ax4.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        # Save figure
        filename = f"ndx_mean_reversion_backtest_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        logger.info(f"Chart saved to {filename}")
        
        plt.show()
    
    def export_trades(self, filename: Optional[str] = None):
        """
        Export trade log to CSV
        
        Args:
            filename: Output filename (optional)
        """
        if not self.trade_log:
            logger.warning("No trades to export")
            return
        
        if filename is None:
            filename = f"ndx_mean_reversion_trades_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        trades_df = pd.DataFrame(self.trade_log)
        trades_df.to_csv(filename, index=False)
        logger.info(f"Trade log exported to {filename}")
    
    def export_portfolio_history(self, filename: Optional[str] = None):
        """
        Export portfolio history to CSV
        
        Args:
            filename: Output filename (optional)
        """
        if not self.portfolio_history:
            logger.warning("No portfolio history to export")
            return
        
        if filename is None:
            filename = f"ndx_mean_reversion_portfolio_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        portfolio_df = pd.DataFrame(self.portfolio_history)
        portfolio_df.to_csv(filename, index=False)
        logger.info(f"Portfolio history exported to {filename}")


def main():
    """
    Main execution function
    """
    print("\n" + "="*80)
    print("NDX MEAN REVERSION STRATEGY - TQQQ/SQQQ TRADING")
    print("="*80 + "\n")
    
    # Initialize strategy with 40-year NDX lookback (1985-01-01)
    # Note: TQQQ/SQQQ launched in Feb 2010, so actual backtest runs from 2010-2025
    # But we use 40 years of NDX history for better signal calculation context
    strategy = NDXMeanReversionStrategy(
        initial_capital=10000.0,
        lookback_period=20,
        entry_z_score=1.5,
        exit_z_score=0.5,
        commission_pct=0.001,
        start_date="1985-01-01",  # 40 years of NDX data for signals
        end_date=None  # Today
    )
    
    # Step 1: Fetch data
    if not strategy.fetch_data():
        logger.error("Failed to fetch data. Exiting...")
        return
    
    # Step 2: Calculate signals
    strategy.calculate_signals()
    
    # Step 3: Run backtest
    results = strategy.backtest()
    
    # Step 4: Print results
    strategy.print_results(results)
    
    # Step 5: Plot results
    strategy.plot_results()
    
    # Step 6: Export data
    strategy.export_trades()
    strategy.export_portfolio_history()
    
    logger.info("Strategy execution completed successfully!")


if __name__ == "__main__":
    main()

