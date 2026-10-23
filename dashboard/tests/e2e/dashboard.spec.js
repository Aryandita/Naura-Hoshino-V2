// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Dashboard Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load dashboard home page', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Naura Hoshino/);
    
    // Check main content is visible
    const mainContent = page.locator('.main-content');
    await expect(mainContent).toBeVisible();
  });

  test('should display sidebar navigation', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();
    
    // Check nav groups exist
    const navGroups = page.locator('.nav-group');
    await expect(navGroups.first()).toBeVisible();
  });

  test('should have working hamburger menu on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    const hamburger = page.locator('#hamburgerBtn');
    await expect(hamburger).toBeVisible();
    
    // Click to open sidebar
    await hamburger.click();
    
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toHaveClass(/open/);
    
    // Close via overlay
    const overlay = page.locator('.sidebar-overlay');
    await overlay.click();
    
    await expect(sidebar).not.toHaveClass(/open/);
  });

  test('should display telemetry cards', async ({ page }) => {
    const telemetryGrid = page.locator('#telemetryGrid');
    await expect(telemetryGrid).toBeVisible();
    
    // Check for metric cards
    const metricCards = page.locator('.metric-card');
    await expect(metricCards.first()).toBeVisible();
  });

  test('should have theme switcher controls', async ({ page }) => {
    const themePill = page.locator('#themeSwitcherPill');
    await expect(themePill).toBeVisible();
    
    const darkLightToggle = page.locator('#themeDarkLightToggle');
    await expect(darkLightToggle).toBeVisible();
  });
});

test.describe('Authentication Flow', () => {
  test('should show login button when not authenticated', async ({ page }) => {
    await page.goto('/');
    
    const authBtn = page.locator('#headerAuthBtn');
    await expect(authBtn).toBeVisible();
    await expect(authBtn).toContainText('Login');
  });

  test('should open auth modal on login click', async ({ page }) => {
    await page.goto('/');
    
    const authBtn = page.locator('#headerAuthBtn');
    await authBtn.click();
    
    const modal = page.locator('#nauraAuthModal');
    await expect(modal).toHaveClass(/open/);
  });

  test('should close auth modal on escape key', async ({ page }) => {
    await page.goto('/');
    
    // Open modal
    const authBtn = page.locator('#headerAuthBtn');
    await authBtn.click();
    
    const modal = page.locator('#nauraAuthModal');
    await expect(modal).toHaveClass(/open/);
    
    // Press Escape
    await page.keyboard.press('Escape');
    
    await expect(modal).not.toHaveClass(/open/);
  });
});

test.describe('Navigation', () => {
  test('should navigate to status page', async ({ page }) => {
    await page.goto('/');
    
    const statusLink = page.locator('a[href="/status"]');
    await statusLink.click();
    
    await expect(page).toHaveURL(/\/status/);
  });

  test('should navigate to music page', async ({ page }) => {
    await page.goto('/');
    
    const musicLink = page.locator('a[href="/music"]');
    await musicLink.click();
    
    await expect(page).toHaveURL(/\/music/);
  });

  test('should navigate to leaderboard page', async ({ page }) => {
    await page.goto('/');
    
    const leaderboardLink = page.locator('a[href="/leaderboard"]');
    await leaderboardLink.click();
    
    await expect(page).toHaveURL(/\/leaderboard/);
  });
});
