/**
 * E2E tests for execution algorithms: TWAP, VWAP, POV
 *
 * This test suite validates the complete workflow from algorithm placement
 * through execution monitoring to completion with realistic market scenarios.
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Execution Algorithms E2E', () => {
    let page: Page;

    test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();

        // Set viewport for consistent testing
        await page.setViewportSize({ width: 1920, height: 1080 });

        // Navigate to application
        await page.goto('http://localhost:3003');

        // Wait for application to load
        await page.waitForLoadState('networkidle');
    });

    test.afterAll(async () => {
        await page.close();
    });

    test('TWAP Algorithm Complete Workflow', async () => {
        test.setTimeout(120000); // 2 minute timeout for complete workflow

        // Navigate to execution page
        await page.click('[data-testid="execution-nav"]');
        await page.waitForSelector('[data-testid="execution-page"]');

        // Configure TWAP algorithm
        await page.selectOption('[data-testid="algorithm-select"]', 'TWAP');

        await page.fill('[data-testid="symbol-input"]', 'AAPL');
        await page.selectOption('[data-testid="side-select"]', 'BUY');
        await page.fill('[data-testid="quantity-input"]', '10000');

        // TWAP specific parameters
        await page.fill('[data-testid="duration-minutes"]', '60');
        await page.fill('[data-testid="slice-count"]', '8');
        await page.fill('[data-testid="max-participation"]', '0.15');

        // Validate form inputs
        const symbolValue = await page.inputValue('[data-testid="symbol-input"]');
        expect(symbolValue).toBe('AAPL');

        const quantityValue = await page.inputValue('[data-testid="quantity-input"]');
        expect(quantityValue).toBe('10000');

        // Submit algorithm
        await page.click('[data-testid="submit-algorithm"]');

        // Wait for algorithm creation confirmation
        await page.waitForSelector('[data-testid="algorithm-created"]', { timeout: 10000 });

        // Get algorithm ID
        const algoIdElement = await page.locator('[data-testid="algorithm-id"]');
        const algoId = await algoIdElement.textContent();
        expect(algoId).toMatch(/^[a-f0-9-]{36}$/); // UUID format

        // Monitor execution progress
        let executionComplete = false;
        let attempts = 0;
        const maxAttempts = 20; // 2 minutes with 6-second intervals

        while (!executionComplete && attempts < maxAttempts) {
            await page.waitForTimeout(6000); // Wait 6 seconds

            // Refresh status
            await page.click('[data-testid="refresh-status"]');

            // Check execution status
            const statusElement = await page.locator('[data-testid="execution-status"]');
            const status = await statusElement.textContent();

            // Check progress
            const progressElement = await page.locator('[data-testid="execution-progress"]');
            const progressText = await progressElement.textContent();

            console.log(`Attempt ${attempts + 1}: Status: ${status}, Progress: ${progressText}`);

            if (status === 'COMPLETED' || status === 'FILLED') {
                executionComplete = true;
            }

            attempts++;
        }

        // Validate completion
        expect(executionComplete).toBe(true);

        // Check execution statistics
        const executedQtyElement = await page.locator('[data-testid="executed-quantity"]');
        const executedQty = parseInt(await executedQtyElement.textContent() || '0');
        expect(executedQty).toBeGreaterThan(0);
        expect(executedQty).toBeLessThanOrEqual(10000);

        // Check average fill price
        const avgPriceElement = await page.locator('[data-testid="avg-fill-price"]');
        const avgPrice = parseFloat(await avgPriceElement.textContent() || '0');
        expect(avgPrice).toBeGreaterThan(100); // Reasonable for AAPL
        expect(avgPrice).toBeLessThan(300);

        // Check execution venues
        const venuesElement = await page.locator('[data-testid="execution-venues"]');
        const venuesText = await venuesElement.textContent() || '';
        const venueCount = venuesText.split(',').length;
        expect(venueCount).toBeGreaterThanOrEqual(1);
        expect(venueCount).toBeLessThanOrEqual(5);

        // Validate execution report details
        await page.click('[data-testid="view-execution-report"]');
        await page.waitForSelector('[data-testid="execution-report-modal"]');

        // Check cost breakdown
        const marketImpactElement = await page.locator('[data-testid="market-impact-bps"]');
        const marketImpact = parseFloat(await marketImpactElement.textContent() || '0');
        expect(marketImpact).toBeGreaterThanOrEqual(0);
        expect(marketImpact).toBeLessThan(50); // Reasonable market impact

        // Check timing cost
        const timingCostElement = await page.locator('[data-testid="timing-cost-bps"]');
        const timingCost = parseFloat(await timingCostElement.textContent() || '0');
        expect(timingCost).toBeGreaterThanOrEqual(0);

        // Close report modal
        await page.click('[data-testid="close-report-modal"]');
    });

    test('VWAP Algorithm with Volume Profile', async () => {
        test.setTimeout(90000); // 1.5 minute timeout

        // Navigate to execution page if not already there
        await page.goto('http://localhost:3003/execution');
        await page.waitForSelector('[data-testid="execution-page"]');

        // Configure VWAP algorithm
        await page.selectOption('[data-testid="algorithm-select"]', 'VWAP');

        await page.fill('[data-testid="symbol-input"]', 'MSFT');
        await page.selectOption('[data-testid="side-select"]', 'SELL');
        await page.fill('[data-testid="quantity-input"]', '5000');

        // VWAP specific parameters
        await page.fill('[data-testid="duration-minutes"]', '120'); // 2 hours
        await page.fill('[data-testid="target-participation"]', '0.12');

        // Enable volume profile
        await page.check('[data-testid="use-volume-profile"]');

        // Validate advanced settings
        const advancedSection = await page.locator('[data-testid="vwap-advanced-settings"]');
        expect(await advancedSection.isVisible()).toBe(true);

        // Submit algorithm
        await page.click('[data-testid="submit-algorithm"]');

        // Wait for creation and get algorithm ID
        await page.waitForSelector('[data-testid="algorithm-created"]');
        const algoIdElement = await page.locator('[data-testid="algorithm-id"]');
        const algoId = await algoIdElement.textContent();

        // Validate execution schedule
        await page.click('[data-testid="view-schedule"]');
        await page.waitForSelector('[data-testid="execution-schedule"]');

        // Check schedule has multiple slices
        const scheduleRows = await page.locator('[data-testid="schedule-row"]').count();
        expect(scheduleRows).toBeGreaterThan(1);
        expect(scheduleRows).toBeLessThanOrEqual(20); // Reasonable for 2-hour execution

        // Check volume-weighted distribution
        const firstSliceQty = await page.locator('[data-testid="schedule-row"]:first-child [data-testid="slice-quantity"]').textContent();
        const lastSliceQty = await page.locator('[data-testid="schedule-row"]:last-child [data-testid="slice-quantity"]').textContent();

        // VWAP should have varying slice sizes based on volume profile
        expect(firstSliceQty).not.toBe(lastSliceQty);

        // Monitor execution for a few iterations
        let monitoringAttempts = 0;
        const maxMonitoringAttempts = 8; // Monitor for ~1 minute

        while (monitoringAttempts < maxMonitoringAttempts) {
            await page.waitForTimeout(8000); // Wait 8 seconds

            await page.click('[data-testid="refresh-status"]');

            const statusElement = await page.locator('[data-testid="execution-status"]');
            const status = await statusElement.textContent();

            if (status === 'COMPLETED' || status === 'FILLED') {
                break;
            }

            // Check real-time participation rate
            const participationElement = await page.locator('[data-testid="current-participation"]');
            const participationRate = parseFloat(await participationElement.textContent() || '0');
            expect(participationRate).toBeGreaterThan(0);
            expect(participationRate).toBeLessThan(0.25); // Within reasonable bounds

            monitoringAttempts++;
        }

        // Check execution quality metrics
        const executionQualityElement = await page.locator('[data-testid="execution-quality"]');
        const qualityScore = await executionQualityElement.textContent();
        expect(['EXCELLENT', 'GOOD', 'FAIR']).toContain(qualityScore);
    });

    test('POV Algorithm with Dynamic Participation', async () => {
        test.setTimeout(60000); // 1 minute timeout

        // Navigate to execution page
        await page.goto('http://localhost:3003/execution');
        await page.waitForSelector('[data-testid="execution-page"]');

        // Configure POV algorithm
        await page.selectOption('[data-testid="algorithm-select"]', 'POV');

        await page.fill('[data-testid="symbol-input"]', 'GOOGL');
        await page.selectOption('[data-testid="side-select"]', 'BUY');
        await page.fill('[data-testid="quantity-input"]', '2000');

        // POV specific parameters
        await page.fill('[data-testid="target-participation"]', '0.20');
        await page.fill('[data-testid="max-participation"]', '0.30');
        await page.fill('[data-testid="min-participation"]', '0.05');

        // Enable surge detection
        await page.check('[data-testid="enable-surge-detection"]');
        await page.fill('[data-testid="surge-threshold"]', '3.0');

        // Submit algorithm
        await page.click('[data-testid="submit-algorithm"]');

        await page.waitForSelector('[data-testid="algorithm-created"]');

        // Monitor dynamic behavior
        let dynamicChecks = 0;
        const maxDynamicChecks = 6;

        while (dynamicChecks < maxDynamicChecks) {
            await page.waitForTimeout(5000); // Wait 5 seconds

            await page.click('[data-testid="refresh-status"]');

            // Check current market volume
            const volumeElement = await page.locator('[data-testid="current-volume"]');
            const currentVolume = parseInt(await volumeElement.textContent() || '0');
            expect(currentVolume).toBeGreaterThan(0);

            // Check adaptive participation rate
            const adaptiveRateElement = await page.locator('[data-testid="adaptive-participation"]');
            const adaptiveRate = parseFloat(await adaptiveRateElement.textContent() || '0');
            expect(adaptiveRate).toBeGreaterThan(0.04); // Above minimum
            expect(adaptiveRate).toBeLessThan(0.35); // Below maximum

            // Check if algorithm is adapting to volume conditions
            if (currentVolume > 100000) { // High volume scenario
                expect(adaptiveRate).toBeLessThanOrEqual(0.25); // Should moderate participation
            }

            dynamicChecks++;
        }

        // Check final execution statistics
        const finalStatusElement = await page.locator('[data-testid="execution-status"]');
        const finalStatus = await finalStatusElement.textContent();

        if (finalStatus === 'COMPLETED') {
            // Validate participation rate adherence
            const avgParticipationElement = await page.locator('[data-testid="avg-participation-rate"]');
            const avgParticipation = parseFloat(await avgParticipationElement.textContent() || '0');
            expect(avgParticipation).toBeGreaterThan(0.15); // Close to target
            expect(avgParticipation).toBeLessThan(0.25);
        }
    });

    test('Algorithm Safety Validation', async () => {
        // Navigate to execution page
        await page.goto('http://localhost:3003/execution');
        await page.waitForSelector('[data-testid="execution-page"]');

        // Test fat-finger protection
        await page.selectOption('[data-testid="algorithm-select"]', 'TWAP');
        await page.fill('[data-testid="symbol-input"]', 'AAPL');
        await page.selectOption('[data-testid="side-select"]', 'BUY');
        await page.fill('[data-testid="quantity-input"]', '50000000'); // Excessive quantity

        // Should trigger safety warning
        await page.click('[data-testid="validate-order"]');
        await page.waitForSelector('[data-testid="safety-warning"]');

        const warningElement = await page.locator('[data-testid="safety-warning"]');
        const warningText = await warningElement.textContent();
        expect(warningText).toContain('excessive');

        // Test price collar validation
        await page.fill('[data-testid="quantity-input"]', '1000'); // Reasonable quantity
        await page.selectOption('[data-testid="order-type"]', 'LIMIT');
        await page.fill('[data-testid="limit-price"]', '300.00'); // Far from market

        await page.click('[data-testid="validate-order"]');
        await page.waitForSelector('[data-testid="price-collar-warning"]');

        const priceWarningElement = await page.locator('[data-testid="price-collar-warning"]');
        const priceWarningText = await priceWarningElement.textContent();
        expect(priceWarningText).toContain('price collar');

        // Test valid order passes validation
        await page.fill('[data-testid="limit-price"]', '155.00'); // Reasonable price
        await page.click('[data-testid="validate-order"]');

        await page.waitForSelector('[data-testid="validation-success"]');
        const successElement = await page.locator('[data-testid="validation-success"]');
        const successText = await successElement.textContent();
        expect(successText).toContain('validated');
    });

    test('Smart Order Router Integration', async () => {
        // Navigate to routing page
        await page.goto('http://localhost:3003/routing');
        await page.waitForSelector('[data-testid="routing-page"]');

        // Configure order for routing
        await page.fill('[data-testid="symbol-input"]', 'TSLA');
        await page.selectOption('[data-testid="side-select"]', 'BUY');
        await page.fill('[data-testid="quantity-input"]', '1500');

        // Check venue statistics before routing
        await page.click('[data-testid="view-venue-stats"]');
        await page.waitForSelector('[data-testid="venue-stats-modal"]');

        // Validate venue statistics display
        const venueRows = await page.locator('[data-testid="venue-row"]').count();
        expect(venueRows).toBeGreaterThan(3); // Multiple venues available

        // Check venue metrics
        const firstVenueRow = page.locator('[data-testid="venue-row"]').first();
        const fillRate = await firstVenueRow.locator('[data-testid="fill-rate"]').textContent();
        expect(parseFloat(fillRate || '0')).toBeGreaterThan(0.7); // Reasonable fill rate

        await page.click('[data-testid="close-venue-stats"]');

        // Submit order for routing
        await page.click('[data-testid="route-order"]');
        await page.waitForSelector('[data-testid="routing-result"]');

        // Validate routing decisions
        const routingDecisions = await page.locator('[data-testid="routing-decision"]').count();
        expect(routingDecisions).toBeGreaterThan(0);
        expect(routingDecisions).toBeLessThanOrEqual(5); // Reasonable fragmentation

        // Check total allocation
        const totalAllocated = await page.locator('[data-testid="total-allocated"]').textContent();
        expect(parseInt(totalAllocated || '0')).toBe(1500);

        // Check best execution compliance
        const bestExElement = await page.locator('[data-testid="best-execution-score"]');
        const bestExScore = parseFloat(await bestExElement.textContent() || '0');
        expect(bestExScore).toBeGreaterThan(0.7); // Good execution quality

        // View execution timeline
        await page.click('[data-testid="view-execution-timeline"]');
        await page.waitForSelector('[data-testid="execution-timeline"]');

        // Check timeline has events
        const timelineEvents = await page.locator('[data-testid="timeline-event"]').count();
        expect(timelineEvents).toBeGreaterThan(0);
    });

    test('Algorithm Performance Analytics', async () => {
        // Navigate to analytics page
        await page.goto('http://localhost:3003/execution/analytics');
        await page.waitForSelector('[data-testid="analytics-page"]');

        // Check performance summary
        const summaryElement = await page.locator('[data-testid="performance-summary"]');
        expect(await summaryElement.isVisible()).toBe(true);

        // Validate key metrics
        const totalOrdersElement = await page.locator('[data-testid="total-orders"]');
        const totalOrders = parseInt(await totalOrdersElement.textContent() || '0');
        expect(totalOrders).toBeGreaterThanOrEqual(0);

        if (totalOrders > 0) {
            // Check average execution metrics
            const avgFillRateElement = await page.locator('[data-testid="avg-fill-rate"]');
            const avgFillRate = parseFloat(await avgFillRateElement.textContent() || '0');
            expect(avgFillRate).toBeGreaterThan(0);
            expect(avgFillRate).toBeLessThanOrEqual(1);

            const avgCostElement = await page.locator('[data-testid="avg-cost-bps"]');
            const avgCost = parseFloat(await avgCostElement.textContent() || '0');
            expect(avgCost).toBeGreaterThanOrEqual(0);
            expect(avgCost).toBeLessThan(100); // Reasonable cost range
        }

        // Check algorithm comparison
        await page.click('[data-testid="algorithm-comparison"]');
        await page.waitForSelector('[data-testid="comparison-chart"]');

        const chartElement = await page.locator('[data-testid="comparison-chart"]');
        expect(await chartElement.isVisible()).toBe(true);

        // Check venue performance analysis
        await page.click('[data-testid="venue-analysis"]');
        await page.waitForSelector('[data-testid="venue-performance-chart"]');

        const venueChartElement = await page.locator('[data-testid="venue-performance-chart"]');
        expect(await venueChartElement.isVisible()).toBe(true);
    });

    test('Real-time Execution Monitoring', async () => {
        // Start a long-running algorithm for monitoring
        await page.goto('http://localhost:3003/execution');
        await page.waitForSelector('[data-testid="execution-page"]');

        // Configure long-duration TWAP
        await page.selectOption('[data-testid="algorithm-select"]', 'TWAP');
        await page.fill('[data-testid="symbol-input"]', 'NVDA');
        await page.selectOption('[data-testid="side-select"]', 'BUY');
        await page.fill('[data-testid="quantity-input"]', '3000');
        await page.fill('[data-testid="duration-minutes"]', '180'); // 3 hours

        await page.click('[data-testid="submit-algorithm"]');
        await page.waitForSelector('[data-testid="algorithm-created"]');

        // Navigate to monitoring dashboard
        await page.click('[data-testid="monitor-execution"]');
        await page.waitForSelector('[data-testid="monitoring-dashboard"]');

        // Check real-time updates
        let monitoringRounds = 0;
        const maxMonitoringRounds = 5;

        while (monitoringRounds < maxMonitoringRounds) {
            await page.waitForTimeout(3000); // Wait 3 seconds

            // Check real-time price updates
            const currentPriceElement = await page.locator('[data-testid="current-price"]');
            const currentPrice = parseFloat(await currentPriceElement.textContent() || '0');
            expect(currentPrice).toBeGreaterThan(100); // Reasonable for NVDA

            // Check execution progress
            const progressElement = await page.locator('[data-testid="execution-progress-bar"]');
            const progressValue = await progressElement.getAttribute('value');
            expect(parseInt(progressValue || '0')).toBeGreaterThanOrEqual(0);
            expect(parseInt(progressValue || '0')).toBeLessThanOrEqual(100);

            // Check market impact monitoring
            const impactElement = await page.locator('[data-testid="market-impact-indicator"]');
            const impactClass = await impactElement.getAttribute('class');
            expect(['low', 'medium', 'high'].some(level => impactClass?.includes(level))).toBe(true);

            monitoringRounds++;
        }

        // Test manual intervention capabilities
        await page.click('[data-testid="pause-execution"]');
        await page.waitForSelector('[data-testid="execution-paused"]');

        const pausedElement = await page.locator('[data-testid="execution-status"]');
        const pausedStatus = await pausedElement.textContent();
        expect(pausedStatus).toBe('PAUSED');

        // Resume execution
        await page.click('[data-testid="resume-execution"]');
        await page.waitForSelector('[data-testid="execution-resumed"]');

        const resumedElement = await page.locator('[data-testid="execution-status"]');
        const resumedStatus = await resumedElement.textContent();
        expect(resumedStatus).toBe('RUNNING');
    });
});