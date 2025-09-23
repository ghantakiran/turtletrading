/**
 * E2E Tests for Indicator Lab Compose-Preview-Save Flow
 *
 * Tests the complete user workflow for creating, composing, previewing,
 * and saving indicator graphs in the TA-Lib indicator laboratory.
 */

import { test, expect, Page } from '@playwright/test';

interface IndicatorNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  parameters: Record<string, any>;
}

interface GraphData {
  nodes: IndicatorNode[];
  edges: Array<{
    source: string;
    target: string;
    sourceOutput: string;
    targetInput: string;
  }>;
}

test.describe('Indicator Lab Compose-Preview-Save Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to indicator lab
    await page.goto('/indicator-lab');

    // Wait for page to load and check for main components
    await expect(page.locator('[data-testid="indicator-lab-canvas"]')).toBeVisible();
    await expect(page.locator('[data-testid="indicator-palette"]')).toBeVisible();
  });

  test('should display indicator lab with visual editor components', async ({ page }) => {
    // Verify main UI components are present
    await expect(page.locator('[data-testid="indicator-lab-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="indicator-palette"]')).toBeVisible();
    await expect(page.locator('[data-testid="indicator-lab-canvas"]')).toBeVisible();
    await expect(page.locator('[data-testid="graph-controls"]')).toBeVisible();

    // Check for essential buttons
    await expect(page.locator('[data-testid="btn-new-graph"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-save-graph"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-preview-graph"]')).toBeVisible();

    // Verify indicator categories are displayed
    await expect(page.locator('[data-testid="category-momentum"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-overlap"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-volume"]')).toBeVisible();
  });

  test('should allow creating new computation graph', async ({ page }) => {
    // Click new graph button
    await page.click('[data-testid="btn-new-graph"]');

    // Fill in graph details modal
    await expect(page.locator('[data-testid="new-graph-modal"]')).toBeVisible();
    await page.fill('[data-testid="input-graph-name"]', 'Test Trading Strategy');
    await page.fill('[data-testid="input-graph-description"]', 'A test strategy using RSI and MACD');

    // Create graph
    await page.click('[data-testid="btn-create-graph"]');

    // Verify graph was created
    await expect(page.locator('[data-testid="new-graph-modal"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="graph-title"]')).toContainText('Test Trading Strategy');

    // Verify canvas is ready for composition
    await expect(page.locator('[data-testid="indicator-lab-canvas"]')).toBeVisible();
    await expect(page.locator('[data-testid="canvas-grid"]')).toBeVisible();
  });

  test('should compose graph by dragging indicators from palette', async ({ page }) => {
    // Create new graph first
    await createNewGraph(page, 'Momentum Strategy', 'RSI and MACD strategy');

    // Get canvas bounds for drag operations
    const canvas = page.locator('[data-testid="indicator-lab-canvas"]');
    const canvasBounds = await canvas.boundingBox();

    // Drag RSI indicator to canvas
    const rsiIndicator = page.locator('[data-testid="indicator-RSI"]');
    await rsiIndicator.dragTo(canvas, {
      targetPosition: {
        x: canvasBounds!.width * 0.3,
        y: canvasBounds!.height * 0.3
      }
    });

    // Verify RSI node was created
    await expect(page.locator('[data-testid="node-RSI"]')).toBeVisible();
    await expect(page.locator('[data-testid="node-RSI"] [data-testid="node-title"]')).toContainText('RSI');

    // Drag MACD indicator to canvas
    const macdIndicator = page.locator('[data-testid="indicator-MACD"]');
    await macdIndicator.dragTo(canvas, {
      targetPosition: {
        x: canvasBounds!.width * 0.7,
        y: canvasBounds!.height * 0.3
      }
    });

    // Verify MACD node was created
    await expect(page.locator('[data-testid="node-MACD"]')).toBeVisible();
    await expect(page.locator('[data-testid="node-MACD"] [data-testid="node-title"]')).toContainText('MACD');

    // Verify both nodes are properly positioned
    const rsiNode = page.locator('[data-testid="node-RSI"]');
    const macdNode = page.locator('[data-testid="node-MACD"]');

    await expect(rsiNode).toBeVisible();
    await expect(macdNode).toBeVisible();
  });

  test('should configure indicator parameters', async ({ page }) => {
    // Create graph and add RSI indicator
    await createNewGraph(page, 'RSI Configuration Test', 'Testing RSI parameter configuration');
    await addIndicatorToCanvas(page, 'RSI', { x: 300, y: 200 });

    // Click on RSI node to select it
    await page.click('[data-testid="node-RSI"]');

    // Verify node is selected
    await expect(page.locator('[data-testid="node-RSI"]')).toHaveClass(/selected/);

    // Open parameter panel
    await expect(page.locator('[data-testid="parameter-panel"]')).toBeVisible();

    // Verify RSI parameters are displayed
    await expect(page.locator('[data-testid="param-timeperiod"]')).toBeVisible();
    await expect(page.locator('[data-testid="param-timeperiod-value"]')).toHaveValue('14');

    // Change RSI period
    await page.fill('[data-testid="param-timeperiod-value"]', '21');

    // Verify parameter change is reflected
    await expect(page.locator('[data-testid="param-timeperiod-value"]')).toHaveValue('21');

    // Verify node title updates to reflect parameter change
    await expect(page.locator('[data-testid="node-RSI"] [data-testid="node-title"]')).toContainText('RSI(21)');
  });

  test('should create connections between indicators', async ({ page }) => {
    // Create graph with SMA and RSI indicators
    await createNewGraph(page, 'Connected Indicators', 'SMA feeding into RSI');

    await addIndicatorToCanvas(page, 'SMA', { x: 200, y: 200 });
    await addIndicatorToCanvas(page, 'RSI', { x: 500, y: 200 });

    // Connect SMA output to RSI input
    const smaOutput = page.locator('[data-testid="node-SMA"] [data-testid="output-sma"]');
    const rsiInput = page.locator('[data-testid="node-RSI"] [data-testid="input-close"]');

    // Drag from SMA output to RSI input to create connection
    await smaOutput.dragTo(rsiInput);

    // Verify connection was created
    await expect(page.locator('[data-testid="edge-SMA-RSI"]')).toBeVisible();

    // Verify connection is visually represented
    const edge = page.locator('[data-testid="edge-SMA-RSI"]');
    await expect(edge).toHaveClass(/edge-connected/);

    // Verify input mapping is updated
    await page.click('[data-testid="node-RSI"]');
    await expect(page.locator('[data-testid="input-mapping-close"]')).toContainText('SMA.sma');
  });

  test('should preview graph computation with sample data', async ({ page }) => {
    // Create graph with RSI indicator
    await createNewGraph(page, 'Preview Test', 'Testing graph preview functionality');
    await addIndicatorToCanvas(page, 'RSI', { x: 300, y: 200 });

    // Configure symbol for preview
    await page.fill('[data-testid="preview-symbol-input"]', 'AAPL');

    // Click preview button
    await page.click('[data-testid="btn-preview-graph"]');

    // Verify preview loading state
    await expect(page.locator('[data-testid="preview-loading"]')).toBeVisible();

    // Wait for computation to complete
    await expect(page.locator('[data-testid="preview-loading"]')).not.toBeVisible({ timeout: 10000 });

    // Verify preview results are displayed
    await expect(page.locator('[data-testid="preview-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-chart"]')).toBeVisible();

    // Verify RSI values are shown
    await expect(page.locator('[data-testid="node-RSI-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="rsi-value-display"]')).toContainText(/\d+\.\d+/);

    // Verify signals are displayed if any
    const signalsPanel = page.locator('[data-testid="signals-panel"]');
    if (await signalsPanel.isVisible()) {
      await expect(signalsPanel.locator('[data-testid="signal-item"]')).toHaveCount({ min: 0 });
    }
  });

  test('should display computation errors gracefully', async ({ page }) => {
    // Create graph with invalid configuration
    await createNewGraph(page, 'Error Test', 'Testing error handling');
    await addIndicatorToCanvas(page, 'RSI', { x: 300, y: 200 });

    // Set invalid symbol
    await page.fill('[data-testid="preview-symbol-input"]', 'INVALID_SYMBOL');

    // Attempt preview
    await page.click('[data-testid="btn-preview-graph"]');

    // Wait for error to appear
    await expect(page.locator('[data-testid="preview-error"]')).toBeVisible({ timeout: 10000 });

    // Verify error message is helpful
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/data|symbol|not found/i);

    // Verify retry option is available
    await expect(page.locator('[data-testid="btn-retry-preview"]')).toBeVisible();
  });

  test('should save graph with all configurations', async ({ page }) => {
    // Create and configure a complete graph
    await createNewGraph(page, 'Complete Strategy', 'Full strategy with multiple indicators');

    // Add indicators
    await addIndicatorToCanvas(page, 'RSI', { x: 200, y: 150 });
    await addIndicatorToCanvas(page, 'MACD', { x: 200, y: 350 });
    await addIndicatorToCanvas(page, 'SMA', { x: 500, y: 250 });

    // Configure RSI parameters
    await page.click('[data-testid="node-RSI"]');
    await page.fill('[data-testid="param-timeperiod-value"]', '14');

    // Configure MACD parameters
    await page.click('[data-testid="node-MACD"]');
    await page.fill('[data-testid="param-fastperiod-value"]', '12');
    await page.fill('[data-testid="param-slowperiod-value"]', '26');

    // Save graph
    await page.click('[data-testid="btn-save-graph"]');

    // Verify save success notification
    await expect(page.locator('[data-testid="save-success-notification"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-success-notification"]')).toContainText(/saved successfully/i);

    // Verify graph appears in saved graphs list
    await page.click('[data-testid="btn-open-saved-graphs"]');
    await expect(page.locator('[data-testid="saved-graph-Complete Strategy"]')).toBeVisible();
  });

  test('should load saved graph with all configurations intact', async ({ page }) => {
    // First, create and save a graph
    await createAndSaveCompleteGraph(page);

    // Navigate away and back
    await page.goto('/dashboard');
    await page.goto('/indicator-lab');

    // Open saved graphs
    await page.click('[data-testid="btn-open-saved-graphs"]');

    // Load the saved graph
    await page.click('[data-testid="saved-graph-Test Complete Strategy"]');

    // Verify graph is loaded correctly
    await expect(page.locator('[data-testid="graph-title"]')).toContainText('Test Complete Strategy');

    // Verify nodes are present
    await expect(page.locator('[data-testid="node-RSI"]')).toBeVisible();
    await expect(page.locator('[data-testid="node-MACD"]')).toBeVisible();

    // Verify parameters are preserved
    await page.click('[data-testid="node-RSI"]');
    await expect(page.locator('[data-testid="param-timeperiod-value"]')).toHaveValue('21');

    await page.click('[data-testid="node-MACD"]');
    await expect(page.locator('[data-testid="param-fastperiod-value"]')).toHaveValue('8');
  });

  test('should support undo/redo operations', async ({ page }) => {
    // Create graph and add indicator
    await createNewGraph(page, 'Undo Test', 'Testing undo/redo functionality');
    await addIndicatorToCanvas(page, 'RSI', { x: 300, y: 200 });

    // Verify RSI node exists
    await expect(page.locator('[data-testid="node-RSI"]')).toBeVisible();

    // Perform undo
    await page.keyboard.press('Control+z');

    // Verify RSI node is removed
    await expect(page.locator('[data-testid="node-RSI"]')).not.toBeVisible();

    // Perform redo
    await page.keyboard.press('Control+y');

    // Verify RSI node is back
    await expect(page.locator('[data-testid="node-RSI"]')).toBeVisible();
  });

  test('should support copy/paste operations for nodes', async ({ page }) => {
    // Create graph and add indicator
    await createNewGraph(page, 'Copy Test', 'Testing copy/paste functionality');
    await addIndicatorToCanvas(page, 'RSI', { x: 300, y: 200 });

    // Configure RSI parameters
    await page.click('[data-testid="node-RSI"]');
    await page.fill('[data-testid="param-timeperiod-value"]', '21');

    // Copy the node
    await page.keyboard.press('Control+c');

    // Paste the node
    await page.keyboard.press('Control+v');

    // Verify copied node exists
    await expect(page.locator('[data-testid="node-RSI-copy"]')).toBeVisible();

    // Verify copied node has same parameters
    await page.click('[data-testid="node-RSI-copy"]');
    await expect(page.locator('[data-testid="param-timeperiod-value"]')).toHaveValue('21');
  });

  test('should validate graph before saving', async ({ page }) => {
    // Create graph with invalid configuration
    await createNewGraph(page, 'Validation Test', 'Testing graph validation');

    // Add RSI with invalid parameters
    await addIndicatorToCanvas(page, 'RSI', { x: 300, y: 200 });
    await page.click('[data-testid="node-RSI"]');
    await page.fill('[data-testid="param-timeperiod-value"]', '-1'); // Invalid value

    // Attempt to save
    await page.click('[data-testid="btn-save-graph"]');

    // Verify validation error
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="validation-error"]')).toContainText(/invalid parameter/i);

    // Verify save is blocked
    await expect(page.locator('[data-testid="save-success-notification"]')).not.toBeVisible();
  });

  test('should export graph in multiple formats', async ({ page }) => {
    // Create and configure graph
    await createAndSaveCompleteGraph(page);

    // Open export dialog
    await page.click('[data-testid="btn-export-graph"]');
    await expect(page.locator('[data-testid="export-modal"]')).toBeVisible();

    // Test JSON export
    await page.click('[data-testid="export-format-json"]');
    await page.click('[data-testid="btn-confirm-export"]');

    // Verify export started
    await expect(page.locator('[data-testid="export-processing"]')).toBeVisible();

    // Wait for export completion
    await expect(page.locator('[data-testid="export-complete"]')).toBeVisible({ timeout: 10000 });

    // Verify download link
    await expect(page.locator('[data-testid="download-link"]')).toBeVisible();
  });

  test('should support keyboard navigation and shortcuts', async ({ page }) => {
    await createNewGraph(page, 'Keyboard Test', 'Testing keyboard navigation');

    // Test Tab navigation through indicator palette
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="indicator-RSI"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="indicator-MACD"]')).toBeFocused();

    // Test Enter to add indicator
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="node-MACD"]')).toBeVisible();

    // Test arrow keys for node movement
    await page.click('[data-testid="node-MACD"]');
    const initialPosition = await page.locator('[data-testid="node-MACD"]').boundingBox();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    const newPosition = await page.locator('[data-testid="node-MACD"]').boundingBox();
    expect(newPosition!.x).toBeGreaterThan(initialPosition!.x);
  });

});

// Helper functions

async function createNewGraph(page: Page, name: string, description: string) {
  await page.click('[data-testid="btn-new-graph"]');
  await page.fill('[data-testid="input-graph-name"]', name);
  await page.fill('[data-testid="input-graph-description"]', description);
  await page.click('[data-testid="btn-create-graph"]');
  await expect(page.locator('[data-testid="new-graph-modal"]')).not.toBeVisible();
}

async function addIndicatorToCanvas(page: Page, indicatorType: string, position: { x: number; y: number }) {
  const canvas = page.locator('[data-testid="indicator-lab-canvas"]');
  const indicator = page.locator(`[data-testid="indicator-${indicatorType}"]`);

  await indicator.dragTo(canvas, {
    targetPosition: position
  });

  await expect(page.locator(`[data-testid="node-${indicatorType}"]`)).toBeVisible();
}

async function createAndSaveCompleteGraph(page: Page) {
  await createNewGraph(page, 'Test Complete Strategy', 'A complete test strategy');

  // Add indicators
  await addIndicatorToCanvas(page, 'RSI', { x: 200, y: 150 });
  await addIndicatorToCanvas(page, 'MACD', { x: 200, y: 350 });

  // Configure parameters
  await page.click('[data-testid="node-RSI"]');
  await page.fill('[data-testid="param-timeperiod-value"]', '21');

  await page.click('[data-testid="node-MACD"]');
  await page.fill('[data-testid="param-fastperiod-value"]', '8');

  // Save graph
  await page.click('[data-testid="btn-save-graph"]');
  await expect(page.locator('[data-testid="save-success-notification"]')).toBeVisible();
}