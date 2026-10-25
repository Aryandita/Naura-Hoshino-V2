"use strict";

class LoginPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/login");
  }

  async clickLoginButton() {
    const loginBtn = this.page.locator("#headerAuthBtn, .login-btn, a[href*=\"/auth/discord\"]");
    await loginBtn.first().click();
  }

  async getAuthModal() {
    return this.page.locator("#nauraAuthModal");
  }

  async isAuthModalOpen() {
    const modal = await this.getAuthModal();
    const className = await modal.getAttribute("class");
    return className && className.includes("open");
  }

  async closeAuthModal() {
    await this.page.keyboard.press("Escape");
  }

  async mockAuthenticatedSession(user) {
    await this.page.context().addCookies([{
      name: "naura.sid",
      value: "mock-session-id",
      domain: "localhost",
      path: "/",
    }]);

    await this.page.route("**/api/me", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          loggedIn: true,
          user: user || { id: "123456789", username: "TestUser", discriminator: "0001" },
          db: { economy_wallet: 1000, economy_bank: 5000 },
          survival: { hp: 100, stamina: 100 },
          isOwner: false,
        }),
      });
    });

    await this.page.route("**/auth/status", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          user: user || { id: "123456789", username: "TestUser" },
          timestamp: Date.now(),
        }),
      });
    });
  }

  async logout() {
    await this.page.goto("/auth/logout");
  }
}

module.exports = { LoginPage };
