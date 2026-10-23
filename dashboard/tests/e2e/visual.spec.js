// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Visual Regression Tests
 * 
 * These tests capture screenshots and compare them against baseline images.
 * Run with: npx playwright test --project=visual-regression
 * Update baselines: npx playwright test --project=visual-regression --update-snapshots
 */

test.describe('Visual Regression - Dashboard', () => {
  test('dashboard home page - midnight theme', async ({ page }) => {
    await page.goto('/');
    
    // Wait for animations to complete
    await page.waitForTimeout(1000);
    
    // Ensure midnight theme is active
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('naura_theme', 'midnight');
    });
    
    await page.waitForTimeout(500);
    
    // Capture full page screenshot
    await expect(page).toHaveScreenshot('dashboard-midnight.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    });
  });

  test('dashboard home page - sakura theme', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Switch to sakura theme
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'sakura');
      localStorage.setItem('naura_theme', 'sakura');
    });
    
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('dashboard-sakura.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    });
  });

  test('dashboard home page - light horizon theme', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Switch to light theme
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light-horizon');
      localStorage.setItem('naura_theme', 'light-horizon');
    });
    
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('dashboard-light.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    });
  });

  test('sidebar collapsed state', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Collapse sidebar
    await page.evaluate(() => {
      document.querySelector('.sidebar')?.classList.add('collapsed');
    });
    
    await page.waitForTimeout(300);
    
    await expect(page).toHaveScreenshot('sidebar-collapsed.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    });
  });

  test('mobile viewport - dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    });
  });
});

test.describe('Visual Regression - Components', () => {
  test('stat cards rendering', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    const statCards = page.locator('.metric-card').first();
    await expect(statCards).toBeVisible();
    
    await expect(statCards).toHaveScreenshot('stat-card.png', {
      maxDiffPixelRatio: 0.01
    });
  });

  test('telemetry chart area', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000); // Wait for chart to render
    
    const chartWrapper = page.locator('.chart-wrapper').first();
    if (await chartWrapper.isVisible()) {
      await expect(chartWrapper).toHaveScreenshot('telemetry-chart.png', {
        maxDiffPixelRatio: 0.02
      });
    }
  });
});

test.describe('Visual Regression - Density Modes', () => {
  test('compact density', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-density', 'compact');
    });
    
    await page.waitForTimeout(300);
    
    await expect(page).toHaveScreenshot('density-compact.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    });
  });

  test('spacious density', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-density', 'spacious');
    });
    
    await page.waitForTimeout(300);
    
    await expect(page).toHaveScreenshot('density-spacious.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    });
  });
});
