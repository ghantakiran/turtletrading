"""
Fundamental Data Scanner

Specialized scanner for fundamental analysis including financial ratios,
earnings data, growth metrics, and valuation screening.
"""

from typing import Dict, List, Any, Optional, Tuple
from decimal import Decimal
import logging
from datetime import datetime, timedelta

from ...models.scanner_models import (
    ScannerConfig, FundamentalFilter, ScanResult, MarketCap, Sector,
    FilterGroup, FilterCondition, ComparisonOperator, AssetType
)
from ...core.scanner_engine import ScannerEngine

logger = logging.getLogger(__name__)


class FundamentalAnalyzer:
    """Analyze fundamental data for scanning"""

    @staticmethod
    def calculate_financial_ratios(financial_data: Dict[str, Any]) -> Dict[str, float]:
        """Calculate key financial ratios"""
        ratios = {}

        try:
            # Valuation ratios
            market_cap = financial_data.get('market_cap', 0)
            shares_outstanding = financial_data.get('shares_outstanding', 0)
            revenue = financial_data.get('revenue', 0)
            net_income = financial_data.get('net_income', 0)
            book_value = financial_data.get('book_value', 0)
            total_debt = financial_data.get('total_debt', 0)
            current_assets = financial_data.get('current_assets', 0)
            current_liabilities = financial_data.get('current_liabilities', 0)
            operating_cash_flow = financial_data.get('operating_cash_flow', 0)

            # Price ratios
            if shares_outstanding > 0:
                price_per_share = market_cap / shares_outstanding

                if net_income > 0:
                    eps = net_income / shares_outstanding
                    ratios['pe_ratio'] = price_per_share / eps if eps > 0 else 0

                if book_value > 0:
                    book_value_per_share = book_value / shares_outstanding
                    ratios['pb_ratio'] = price_per_share / book_value_per_share if book_value_per_share > 0 else 0

            if revenue > 0:
                ratios['ps_ratio'] = market_cap / revenue
                ratios['net_margin'] = (net_income / revenue) * 100

            # Liquidity ratios
            if current_liabilities > 0:
                ratios['current_ratio'] = current_assets / current_liabilities

            # Efficiency ratios
            if total_debt > 0 and book_value > 0:
                ratios['debt_to_equity'] = total_debt / book_value

            # Cash flow ratios
            if operating_cash_flow > 0 and market_cap > 0:
                ratios['price_to_cash_flow'] = market_cap / operating_cash_flow

            return ratios

        except Exception as e:
            logger.error(f"Error calculating financial ratios: {e}")
            return {}

    @staticmethod
    def calculate_growth_metrics(historical_data: List[Dict[str, Any]]) -> Dict[str, float]:
        """Calculate growth metrics from historical financial data"""
        growth_metrics = {}

        try:
            if len(historical_data) < 2:
                return growth_metrics

            # Sort by date
            sorted_data = sorted(historical_data, key=lambda x: x.get('date', ''))

            # Calculate growth rates
            latest = sorted_data[-1]
            previous = sorted_data[-2] if len(sorted_data) >= 2 else sorted_data[-1]

            # Revenue growth
            latest_revenue = latest.get('revenue', 0)
            previous_revenue = previous.get('revenue', 0)
            if previous_revenue > 0:
                growth_metrics['revenue_growth'] = ((latest_revenue - previous_revenue) / previous_revenue) * 100

            # Earnings growth
            latest_earnings = latest.get('net_income', 0)
            previous_earnings = previous.get('net_income', 0)
            if previous_earnings > 0:
                growth_metrics['earnings_growth'] = ((latest_earnings - previous_earnings) / previous_earnings) * 100

            # Multi-year growth rates
            if len(sorted_data) >= 4:  # 3+ years of data
                three_years_ago = sorted_data[-4]

                three_year_revenue = three_years_ago.get('revenue', 0)
                if three_year_revenue > 0:
                    cagr_revenue = (((latest_revenue / three_year_revenue) ** (1/3)) - 1) * 100
                    growth_metrics['revenue_cagr_3y'] = cagr_revenue

                three_year_earnings = three_years_ago.get('net_income', 0)
                if three_year_earnings > 0:
                    cagr_earnings = (((latest_earnings / three_year_earnings) ** (1/3)) - 1) * 100
                    growth_metrics['earnings_cagr_3y'] = cagr_earnings

            return growth_metrics

        except Exception as e:
            logger.error(f"Error calculating growth metrics: {e}")
            return {}

    @staticmethod
    def calculate_quality_scores(financial_data: Dict[str, Any]) -> Dict[str, float]:
        """Calculate quality scores based on financial health"""
        scores = {}

        try:
            # Profitability score
            net_margin = financial_data.get('net_margin', 0)
            roe = financial_data.get('return_on_equity', 0)
            roa = financial_data.get('return_on_assets', 0)

            profitability_score = min(100, max(0, (net_margin + roe + roa) / 3 * 5))
            scores['profitability_score'] = profitability_score

            # Financial strength score
            current_ratio = financial_data.get('current_ratio', 1)
            debt_to_equity = financial_data.get('debt_to_equity', 0)

            # Normalize ratios
            current_ratio_score = min(100, max(0, (current_ratio - 0.5) * 50))
            debt_score = max(0, 100 - (debt_to_equity * 20))

            financial_strength = (current_ratio_score + debt_score) / 2
            scores['financial_strength_score'] = financial_strength

            # Growth consistency score
            revenue_growth = financial_data.get('revenue_growth', 0)
            earnings_growth = financial_data.get('earnings_growth', 0)

            growth_score = min(100, max(0, (abs(revenue_growth) + abs(earnings_growth)) / 2))
            scores['growth_score'] = growth_score

            # Overall quality score
            overall_score = (profitability_score + financial_strength + growth_score) / 3
            scores['overall_quality_score'] = overall_score

            return scores

        except Exception as e:
            logger.error(f"Error calculating quality scores: {e}")
            return {}

    @staticmethod
    def categorize_market_cap(market_cap: float) -> MarketCap:
        """Categorize market cap into size buckets"""
        if market_cap < 50_000_000:
            return MarketCap.NANO
        elif market_cap < 300_000_000:
            return MarketCap.MICRO
        elif market_cap < 2_000_000_000:
            return MarketCap.SMALL
        elif market_cap < 10_000_000_000:
            return MarketCap.MID
        elif market_cap < 200_000_000_000:
            return MarketCap.LARGE
        else:
            return MarketCap.MEGA

    @staticmethod
    def calculate_dividend_metrics(financial_data: Dict[str, Any]) -> Dict[str, float]:
        """Calculate dividend-related metrics"""
        metrics = {}

        try:
            dividend_per_share = financial_data.get('dividend_per_share', 0)
            stock_price = financial_data.get('stock_price', 0)
            eps = financial_data.get('eps', 0)
            dividends_paid = financial_data.get('dividends_paid', 0)
            free_cash_flow = financial_data.get('free_cash_flow', 0)

            # Dividend yield
            if stock_price > 0:
                metrics['dividend_yield'] = (dividend_per_share / stock_price) * 100

            # Payout ratio
            if eps > 0:
                metrics['payout_ratio'] = (dividend_per_share / eps) * 100

            # Dividend coverage
            if dividends_paid > 0 and free_cash_flow > 0:
                metrics['dividend_coverage'] = free_cash_flow / dividends_paid

            return metrics

        except Exception as e:
            logger.error(f"Error calculating dividend metrics: {e}")
            return {}


class FundamentalScanner:
    """
    Scanner specialized for fundamental analysis

    Provides pre-built scanning strategies for value investing,
    growth investing, and quality screening.
    """

    def __init__(self, scanner_engine: ScannerEngine):
        self.scanner_engine = scanner_engine
        self.analyzer = FundamentalAnalyzer()

    async def scan_value_stocks(self, universe: List[str], max_pe: float = 15.0,
                               max_pb: float = 2.0, min_dividend_yield: float = 2.0) -> List[ScanResult]:
        """Scan for undervalued stocks using value metrics"""
        config = ScannerConfig(
            name="Value Stocks Scanner",
            scanner_type="fundamental",
            asset_types=[AssetType.STOCK],
            universe=universe,
            fundamental_filter=FundamentalFilter(
                pe_ratio_max=Decimal(str(max_pe)),
                dividend_yield_min=Decimal(str(min_dividend_yield))
            ),
            sort_by="pe_ratio",
            sort_order="asc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_growth_stocks(self, universe: List[str], min_revenue_growth: float = 15.0,
                                min_earnings_growth: float = 20.0) -> List[ScanResult]:
        """Scan for growth stocks with strong growth metrics"""
        config = ScannerConfig(
            name="Growth Stocks Scanner",
            scanner_type="fundamental",
            asset_types=[AssetType.STOCK],
            universe=universe,
            fundamental_filter=FundamentalFilter(
                revenue_growth_min=Decimal(str(min_revenue_growth)),
                eps_growth_min=Decimal(str(min_earnings_growth))
            ),
            sort_by="revenue_growth",
            sort_order="desc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_dividend_stocks(self, universe: List[str], min_yield: float = 3.0,
                                  max_payout_ratio: float = 80.0) -> List[ScanResult]:
        """Scan for dividend-paying stocks"""
        custom_conditions = FilterGroup(
            operator="AND",
            conditions=[
                FilterCondition(
                    field="fundamentals.dividend_yield",
                    operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    value=min_yield
                ),
                FilterCondition(
                    field="fundamentals.payout_ratio",
                    operator=ComparisonOperator.LESS_THAN_OR_EQUAL,
                    value=max_payout_ratio
                )
            ]
        )

        config = ScannerConfig(
            name="Dividend Stocks Scanner",
            scanner_type="fundamental",
            asset_types=[AssetType.STOCK],
            universe=universe,
            custom_conditions=custom_conditions,
            sort_by="fundamentals.dividend_yield",
            sort_order="desc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_quality_stocks(self, universe: List[str], min_quality_score: float = 70.0) -> List[ScanResult]:
        """Scan for high-quality stocks based on financial health"""
        custom_conditions = FilterGroup(
            operator="AND",
            conditions=[
                FilterCondition(
                    field="fundamentals.overall_quality_score",
                    operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    value=min_quality_score
                )
            ]
        )

        config = ScannerConfig(
            name="Quality Stocks Scanner",
            scanner_type="fundamental",
            asset_types=[AssetType.STOCK],
            universe=universe,
            custom_conditions=custom_conditions,
            sort_by="fundamentals.overall_quality_score",
            sort_order="desc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_small_cap_growth(self, universe: List[str], max_market_cap: float = 2_000_000_000,
                                   min_growth: float = 25.0) -> List[ScanResult]:
        """Scan for small-cap growth stocks"""
        config = ScannerConfig(
            name="Small Cap Growth Scanner",
            scanner_type="fundamental",
            asset_types=[AssetType.STOCK],
            universe=universe,
            fundamental_filter=FundamentalFilter(
                market_cap_max=Decimal(str(max_market_cap)),
                market_cap_category=MarketCap.SMALL,
                revenue_growth_min=Decimal(str(min_growth))
            ),
            sort_by="revenue_growth",
            sort_order="desc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_large_cap_value(self, universe: List[str], min_market_cap: float = 10_000_000_000,
                                  max_pe: float = 20.0) -> List[ScanResult]:
        """Scan for large-cap value stocks"""
        config = ScannerConfig(
            name="Large Cap Value Scanner",
            scanner_type="fundamental",
            asset_types=[AssetType.STOCK],
            universe=universe,
            fundamental_filter=FundamentalFilter(
                market_cap_min=Decimal(str(min_market_cap)),
                market_cap_category=MarketCap.LARGE,
                pe_ratio_max=Decimal(str(max_pe))
            ),
            sort_by="pe_ratio",
            sort_order="asc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_profitable_companies(self, universe: List[str], min_net_margin: float = 10.0,
                                       min_roe: float = 15.0) -> List[ScanResult]:
        """Scan for highly profitable companies"""
        custom_conditions = FilterGroup(
            operator="AND",
            conditions=[
                FilterCondition(
                    field="fundamentals.net_margin",
                    operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    value=min_net_margin
                ),
                FilterCondition(
                    field="fundamentals.return_on_equity",
                    operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    value=min_roe
                )
            ]
        )

        config = ScannerConfig(
            name="Profitable Companies Scanner",
            scanner_type="fundamental",
            asset_types=[AssetType.STOCK],
            universe=universe,
            custom_conditions=custom_conditions,
            sort_by="fundamentals.net_margin",
            sort_order="desc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_sector_leaders(self, universe: List[str], sector: Sector,
                                 metric: str = "market_cap") -> List[ScanResult]:
        """Scan for leaders in a specific sector"""
        config = ScannerConfig(
            name=f"{sector.value.title()} Sector Leaders",
            scanner_type="fundamental",
            asset_types=[AssetType.STOCK],
            universe=universe,
            fundamental_filter=FundamentalFilter(
                sector=[sector]
            ),
            sort_by=f"fundamentals.{metric}",
            sort_order="desc",
            limit=20
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_low_debt_companies(self, universe: List[str], max_debt_to_equity: float = 0.3) -> List[ScanResult]:
        """Scan for companies with low debt levels"""
        custom_conditions = FilterGroup(
            operator="AND",
            conditions=[
                FilterCondition(
                    field="fundamentals.debt_to_equity",
                    operator=ComparisonOperator.LESS_THAN_OR_EQUAL,
                    value=max_debt_to_equity
                )
            ]
        )

        config = ScannerConfig(
            name="Low Debt Companies Scanner",
            scanner_type="fundamental",
            asset_types=[AssetType.STOCK],
            universe=universe,
            custom_conditions=custom_conditions,
            sort_by="fundamentals.debt_to_equity",
            sort_order="asc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_cash_rich_companies(self, universe: List[str], min_cash_ratio: float = 0.2) -> List[ScanResult]:
        """Scan for companies with strong cash positions"""
        custom_conditions = FilterGroup(
            operator="AND",
            conditions=[
                FilterCondition(
                    field="fundamentals.cash_ratio",
                    operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    value=min_cash_ratio
                )
            ]
        )

        config = ScannerConfig(
            name="Cash Rich Companies Scanner",
            scanner_type="fundamental",
            asset_types=[AssetType.STOCK],
            universe=universe,
            custom_conditions=custom_conditions,
            sort_by="fundamentals.cash_ratio",
            sort_order="desc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def calculate_fundamental_metrics(self, symbol: str, financial_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate comprehensive fundamental metrics for a symbol"""
        try:
            metrics = {}

            # Basic financial ratios
            ratios = self.analyzer.calculate_financial_ratios(financial_data)
            metrics.update(ratios)

            # Growth metrics (if historical data available)
            historical_data = financial_data.get('historical', [])
            if historical_data:
                growth_metrics = self.analyzer.calculate_growth_metrics(historical_data)
                metrics.update(growth_metrics)

            # Quality scores
            quality_scores = self.analyzer.calculate_quality_scores({**financial_data, **metrics})
            metrics.update(quality_scores)

            # Market cap category
            market_cap = financial_data.get('market_cap', 0)
            if market_cap:
                metrics['market_cap_category'] = self.analyzer.categorize_market_cap(market_cap).value

            # Dividend metrics
            dividend_metrics = self.analyzer.calculate_dividend_metrics(financial_data)
            metrics.update(dividend_metrics)

            # Sector and industry
            metrics['sector'] = financial_data.get('sector', 'Unknown')
            metrics['industry'] = financial_data.get('industry', 'Unknown')

            # Additional derived metrics
            if 'pe_ratio' in metrics and 'earnings_growth' in metrics:
                pe_ratio = metrics['pe_ratio']
                growth_rate = metrics['earnings_growth']
                if growth_rate > 0:
                    metrics['peg_ratio'] = pe_ratio / growth_rate

            return metrics

        except Exception as e:
            logger.error(f"Error calculating fundamental metrics for {symbol}: {e}")
            return {}

    def create_custom_fundamental_scanner(
        self,
        name: str,
        valuation_criteria: Optional[Dict[str, float]] = None,  # {'max_pe': 20, 'max_pb': 3}
        growth_criteria: Optional[Dict[str, float]] = None,    # {'min_revenue_growth': 15, 'min_earnings_growth': 20}
        profitability_criteria: Optional[Dict[str, float]] = None,  # {'min_net_margin': 10, 'min_roe': 15}
        financial_strength: Optional[Dict[str, float]] = None,      # {'max_debt_to_equity': 0.5, 'min_current_ratio': 1.5}
        dividend_criteria: Optional[Dict[str, float]] = None,       # {'min_dividend_yield': 3, 'max_payout_ratio': 80}
        market_cap_range: Optional[Tuple[float, float]] = None,
        sectors: Optional[List[Sector]] = None
    ) -> ScannerConfig:
        """Create custom fundamental scanner configuration"""

        # Build fundamental filter
        fundamental_filter = FundamentalFilter()

        if valuation_criteria:
            if 'max_pe' in valuation_criteria:
                fundamental_filter.pe_ratio_max = Decimal(str(valuation_criteria['max_pe']))
            if 'min_pe' in valuation_criteria:
                fundamental_filter.pe_ratio_min = Decimal(str(valuation_criteria['min_pe']))

        if growth_criteria:
            if 'min_revenue_growth' in growth_criteria:
                fundamental_filter.revenue_growth_min = Decimal(str(growth_criteria['min_revenue_growth']))
            if 'min_earnings_growth' in growth_criteria:
                fundamental_filter.eps_growth_min = Decimal(str(growth_criteria['min_earnings_growth']))

        if dividend_criteria:
            if 'min_dividend_yield' in dividend_criteria:
                fundamental_filter.dividend_yield_min = Decimal(str(dividend_criteria['min_dividend_yield']))

        if market_cap_range:
            fundamental_filter.market_cap_min = Decimal(str(market_cap_range[0]))
            fundamental_filter.market_cap_max = Decimal(str(market_cap_range[1]))

        if sectors:
            fundamental_filter.sector = sectors

        # Build custom conditions for more complex criteria
        conditions = []

        if profitability_criteria:
            for metric, value in profitability_criteria.items():
                conditions.append(FilterCondition(
                    field=f"fundamentals.{metric}",
                    operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    value=value
                ))

        if financial_strength:
            for metric, value in financial_strength.items():
                if 'max_' in metric:
                    operator = ComparisonOperator.LESS_THAN_OR_EQUAL
                    field = metric.replace('max_', '')
                else:
                    operator = ComparisonOperator.GREATER_THAN_OR_EQUAL
                    field = metric.replace('min_', '')

                conditions.append(FilterCondition(
                    field=f"fundamentals.{field}",
                    operator=operator,
                    value=value
                ))

        custom_conditions = None
        if conditions:
            custom_conditions = FilterGroup(
                operator="AND",
                conditions=conditions
            )

        return ScannerConfig(
            name=name,
            scanner_type="fundamental",
            asset_types=[AssetType.STOCK],
            fundamental_filter=fundamental_filter,
            custom_conditions=custom_conditions,
            sort_by="match_score",
            sort_order="desc"
        )