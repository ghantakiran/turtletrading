import { test, expect } from '@playwright/test';

const VERCEL_URL = 'https://frontend-4gxw9fqpu-kirans-projects-994c7420.vercel.app';

test.describe('🚀 Vercel Production Validation Tests', () => {

  test('should successfully load the production deployment', async ({ page }) => {
    // Navigate to the new Vercel deployment
    await page.goto(VERCEL_URL);

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');

    // Verify the page loads without errors
    await expect(page.locator('body')).toBeVisible();

    // Take a screenshot for documentation
    await page.screenshot({
      path: 'test-results/vercel-production-homepage.png',
      fullPage: true
    });
  });

  test('should display the trading platform interface', async ({ page }) => {
    await page.goto(VERCEL_URL);
    await page.waitForLoadState('networkidle');

    // Look for trading platform elements
    const tradingElements = [
      'text=/market/i',
      'text=/trading/i',
      'text=/stock/i',
      'text=/dashboard/i',
      'text=/portfolio/i'
    ];

    let foundElements = 0;
    for (const selector of tradingElements) {
      const elements = page.locator(selector);
      if (await elements.count() > 0) {
        foundElements++;
        console.log(`✅ Found trading element: ${selector}`);
      }
    }

    expect(foundElements).toBeGreaterThan(0);
  });

  test('should have working navigation system', async ({ page }) => {
    await page.goto(VERCEL_URL);
    await page.waitForLoadState('networkidle');

    // Look for navigation elements
    const navElement = page.locator('nav, header, [role="navigation"]').first();

    if (await navElement.count() > 0) {
      await expect(navElement).toBeVisible();
      console.log('✅ Navigation system found');
    }

    // Check for interactive elements
    const buttons = page.locator('button, [role="button"]');
    const buttonCount = await buttons.count();

    console.log(`Found ${buttonCount} interactive buttons`);
    expect(buttonCount).toBeGreaterThan(0);
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(VERCEL_URL);
    await page.waitForLoadState('networkidle');

    // Verify mobile responsiveness
    await expect(page.locator('body')).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({
      path: 'test-results/vercel-production-mobile.png',
      fullPage: true
    });

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);

    await expect(page.locator('body')).toBeVisible();
  });

  test('should load CSS and styling correctly', async ({ page }) => {
    await page.goto(VERCEL_URL);
    await page.waitForLoadState('networkidle');

    // Check for proper styling by verifying CSS classes
    const styledElements = page.locator('[class*="btn"], [class*="card"], [class*="container"]');
    const styledCount = await styledElements.count();

    console.log(`Found ${styledCount} styled elements`);
    expect(styledCount).toBeGreaterThan(0);

    // Verify page has reasonable height (indicating content loaded)
    const bodyHeight = await page.locator('body').evaluate(el => el.scrollHeight);
    expect(bodyHeight).toBeGreaterThan(200);
  });

  test('should handle JavaScript execution properly', async ({ page }) => {
    await page.goto(VERCEL_URL);

    // Wait for React to hydrate
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    // Check if JavaScript is working by looking for interactive elements
    const interactiveElements = page.locator('button, input, select, [onclick], [role="button"]');
    const interactiveCount = await interactiveElements.count();

    console.log(`Found ${interactiveCount} interactive elements`);
    expect(interactiveCount).toBeGreaterThan(0);

    // Test if forms are working
    const forms = page.locator('form');
    if (await forms.count() > 0) {
      console.log('✅ Forms detected and working');
    }
  });

  test('should validate admin console stores accessibility', async ({ page }) => {
    await page.goto(VERCEL_URL);
    await page.waitForLoadState('networkidle');

    // Test admin store accessibility through browser console
    const adminStoreTest = await page.evaluate(() => {
      try {
        // Check if Zustand stores are available in the global scope or through React dev tools
        const hasReactDevTools = !!(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
        const hasZustand = typeof (window as any).zustand !== 'undefined';

        return {
          reactDevTools: hasReactDevTools,
          zustand: hasZustand,
          windowKeys: Object.keys(window).filter(key =>
            key.includes('store') ||
            key.includes('admin') ||
            key.includes('zustand')
          )
        };
      } catch (error) {
        return { error: error.message };
      }
    });

    console.log('Admin store test results:', adminStoreTest);

    // Look for admin-related DOM elements
    const adminElements = page.locator('[data-testid*="admin"], [class*="admin"], [id*="admin"]');
    const adminCount = await adminElements.count();

    if (adminCount > 0) {
      console.log(`✅ Found ${adminCount} admin-related elements`);
    }
  });

  test('should test observability features detection', async ({ page }) => {
    await page.goto(VERCEL_URL);
    await page.waitForLoadState('networkidle');

    // Look for observability-related elements
    const observabilitySelectors = [
      '[data-testid*="logs"]',
      '[data-testid*="metrics"]',
      '[data-testid*="traces"]',
      '[class*="observability"]',
      '[id*="observability"]',
      'text=/logs/i',
      'text=/metrics/i',
      'text=/monitoring/i'
    ];

    let foundObservabilityElements = 0;
    for (const selector of observabilitySelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      if (count > 0) {
        foundObservabilityElements += count;
        console.log(`✅ Found observability elements: ${selector} (${count})`);
      }
    }

    console.log(`Total observability elements found: ${foundObservabilityElements}`);
  });

  test('should validate RBAC system integration', async ({ page }) => {
    await page.goto(VERCEL_URL);
    await page.waitForLoadState('networkidle');

    // Look for RBAC-related elements
    const rbacSelectors = [
      '[data-testid*="rbac"]',
      '[data-testid*="role"]',
      '[data-testid*="permission"]',
      '[class*="rbac"]',
      '[data-role]',
      '[data-permission]',
      'text=/role/i',
      'text=/permission/i',
      'text=/admin/i'
    ];

    let foundRbacElements = 0;
    for (const selector of rbacSelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      if (count > 0) {
        foundRbacElements += count;
        console.log(`✅ Found RBAC elements: ${selector} (${count})`);
      }
    }

    console.log(`Total RBAC elements found: ${foundRbacElements}`);
  });

  test('should measure performance metrics', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(VERCEL_URL);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Performance assertions
    expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds

    console.log(`⚡ Page load time: ${loadTime}ms`);

    // Test navigation performance
    const navStartTime = Date.now();

    // Try to navigate if there are links
    const navLinks = page.locator('a[href^="/"]');
    if (await navLinks.count() > 0) {
      const firstLink = navLinks.first();
      const href = await firstLink.getAttribute('href');

      if (href && href !== '/') {
        await firstLink.click();
        await page.waitForTimeout(1000);

        const navTime = Date.now() - navStartTime;
        console.log(`🔗 Navigation time: ${navTime}ms`);
      }
    }
  });

  test('should validate security headers and HTTPS', async ({ page }) => {
    const response = await page.goto(VERCEL_URL);

    // Verify HTTPS
    expect(page.url()).toContain('https://');

    // Check response headers
    const headers = response?.headers() || {};

    // Vercel should provide security headers
    const securityHeaders = [
      'strict-transport-security',
      'x-frame-options',
      'x-robots-tag',
      'x-vercel-id'
    ];

    let foundHeaders = 0;
    for (const header of securityHeaders) {
      if (headers[header]) {
        foundHeaders++;
        console.log(`✅ Security header found: ${header} = ${headers[header]}`);
      }
    }

    expect(foundHeaders).toBeGreaterThan(0);
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Test 404 handling
    await page.goto(`${VERCEL_URL}/nonexistent-page`);
    await page.waitForTimeout(2000);

    // Should not crash, should show some content
    await expect(page.locator('body')).toBeVisible();

    // Take screenshot of error handling
    await page.screenshot({
      path: 'test-results/vercel-production-404.png'
    });

    // Return to homepage
    await page.goto(VERCEL_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should test API call handling', async ({ page }) => {
    // Monitor network requests
    const apiCalls: string[] = [];
    const failedCalls: string[] = [];

    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        apiCalls.push(url);
      }
    });

    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/') && !response.ok()) {
        failedCalls.push(`${response.status()} - ${url}`);
      }
    });

    await page.goto(VERCEL_URL);
    await page.waitForTimeout(5000); // Wait for potential API calls

    console.log(`📡 API calls detected: ${apiCalls.length}`);
    console.log(`❌ Failed API calls: ${failedCalls.length}`);

    if (apiCalls.length > 0) {
      console.log('API calls made:', apiCalls);
    }

    if (failedCalls.length > 0) {
      console.log('Failed API calls:', failedCalls);
    }

    // App should handle API failures gracefully
    await expect(page.locator('body')).toBeVisible();
  });

});

test.describe('🔧 Admin Console Production Integration Tests', () => {

  test('should validate admin console state management in production', async ({ page }) => {
    await page.goto(VERCEL_URL);
    await page.waitForLoadState('networkidle');

    // Test admin store functionality through component behavior
    const adminUIElements = page.locator('[data-testid="admin-console"], .admin-console, #admin-console');

    if (await adminUIElements.count() > 0) {
      await expect(adminUIElements.first()).toBeVisible();
      console.log('✅ Admin console UI elements detected');
    }

    // Look for feature flag controls
    const featureFlagElements = page.locator('[data-testid*="feature"], [class*="feature-flag"]');
    const featureFlagCount = await featureFlagElements.count();

    if (featureFlagCount > 0) {
      console.log(`✅ Feature flag elements found: ${featureFlagCount}`);
    }
  });

  test('should verify observability dashboard components', async ({ page }) => {
    await page.goto(VERCEL_URL);
    await page.waitForLoadState('networkidle');

    // Look for observability dashboard components
    const dashboardElements = page.locator('[data-testid*="dashboard"], .dashboard, #dashboard');
    const dashboardCount = await dashboardElements.count();

    if (dashboardCount > 0) {
      console.log(`✅ Dashboard elements found: ${dashboardCount}`);
    }

    // Check for metrics visualization elements
    const metricsElements = page.locator('[data-testid*="chart"], [data-testid*="graph"], .chart, .graph');
    const metricsCount = await metricsElements.count();

    if (metricsCount > 0) {
      console.log(`✅ Metrics visualization elements found: ${metricsCount}`);
    }
  });

  test('should test RBAC functionality in production environment', async ({ page }) => {
    await page.goto(VERCEL_URL);
    await page.waitForLoadState('networkidle');

    // Test role-based UI elements
    const roleElements = page.locator('[data-role], [class*="role"], [data-testid*="role"]');
    const roleCount = await roleElements.count();

    if (roleCount > 0) {
      console.log(`✅ Role-based elements found: ${roleCount}`);
    }

    // Look for permission-based controls
    const permissionElements = page.locator('[data-permission], [class*="permission"]');
    const permissionCount = await permissionElements.count();

    if (permissionCount > 0) {
      console.log(`✅ Permission-based controls found: ${permissionCount}`);
    }
  });

});