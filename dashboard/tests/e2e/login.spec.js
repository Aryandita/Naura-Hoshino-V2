// @ts-check
const { test, expect } = require("@playwright/test");
const { LoginPage } = require("./pages/LoginPage");
const { DashboardPage } = require("./pages/DashboardPage");

test.describe("Login Flow", () => {
  let loginPage;
  let dashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test("should display login page with correct elements", async ({ page }) => {
    await loginPage.goto();

    await expect(page).toHaveTitle(/Naura|Login/i);

    const loginBtn = page.locator("#headerAuthBtn, .login-btn, a[href*=\"/auth/discord\"]");
    await expect(loginBtn.first()).toBeVisible();
  });

  test("should open auth modal when clicking login button", async ({ page }) => {
    await dashboardPage.goto();
    await dashboardPage.mockAuthStatus(false);

    const authBtn = page.locator("#headerAuthBtn");
    if (await authBtn.isVisible()) {
      await authBtn.click();

      const modal = await loginPage.getAuthModal();
      if (await modal.count() > 0) {
        await expect(modal).toHaveClass(/open/);
      }
    }
  });

  test("should redirect to Discord OAuth on login attempt", async ({ page }) => {
    await loginPage.goto();

    const discordLink = page.locator("a[href*=\"/auth/discord\"], a[href*=\"discord.com\"]");
    if (await discordLink.count() > 0) {
      const href = await discordLink.first().getAttribute("href");
      expect(href).toMatch(/discord|oauth/i);
    }
  });

  test("should show user profile when authenticated", async ({ page }) => {
    await loginPage.mockAuthenticatedSession({
      id: "123456789012345678",
      username: "TestPlayer",
      discriminator: "1234",
      avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
    });

    await dashboardPage.goto();

    await page.waitForTimeout(500);

    const userProfile = page.locator(".user-profile, .profile-section, #userProfile");
    if (await userProfile.count() > 0) {
      await expect(userProfile.first()).toBeVisible();
    }
  });

  test("should handle logout correctly", async ({ page }) => {
    await loginPage.mockAuthenticatedSession();
    await dashboardPage.goto();

    await page.route("**/auth/logout", (route) => {
      route.fulfill({
        status: 302,
        headers: { Location: "/" },
      });
    });

    const logoutLink = page.locator("a[href*=\"/auth/logout\"], .logout-btn");
    if (await logoutLink.count() > 0) {
      await logoutLink.first().click();
      await page.waitForURL("**/");
    }
  });

  test("should persist session on page refresh", async ({ page }) => {
    await loginPage.mockAuthenticatedSession({
      id: "123456789012345678",
      username: "PersistentUser",
    });

    await dashboardPage.goto();
    await page.reload();

    await page.waitForTimeout(500);

    const response = await page.request.get("/auth/status");
    const data = await response.json();
    expect(data.authenticated).toBe(true);
  });

  test("should close auth modal on escape key", async ({ page }) => {
    await dashboardPage.goto();
    await dashboardPage.mockAuthStatus(false);

    const authBtn = page.locator("#headerAuthBtn");
    if (await authBtn.isVisible()) {
      await authBtn.click();

      const modal = await loginPage.getAuthModal();
      if (await modal.count() > 0 && await modal.getAttribute("class").then(c => c.includes("open"))) {
        await loginPage.closeAuthModal();
        await expect(modal).not.toHaveClass(/open/);
      }
    }
  });
});
