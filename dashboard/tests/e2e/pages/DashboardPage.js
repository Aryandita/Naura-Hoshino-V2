"use strict";

class DashboardPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/");
  }

  async getTitle() {
    return this.page.title();
  }

  async getSidebar() {
    return this.page.locator(".sidebar");
  }

  async isSidebarVisible() {
    const sidebar = await this.getSidebar();
    return sidebar.isVisible();
  }

  async navigateTo(path) {
    await this.page.goto(path);
  }

  async clickNavLink(href) {
    const link = this.page.locator(`a[href="${href}"]`);
    await link.click();
  }

  async getTelemetryGrid() {
    return this.page.locator("#telemetryGrid");
  }

  async mockStatsAPI(stats) {
    await this.page.route("**/api/stats", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(stats || {
          botName: "Naura Hoshino",
          servers: 10,
          users: 1000,
          ping: 50,
          uptime: "1d 2h",
          ram: "1.5GB / 4GB",
          ramPercent: 37.5,
        }),
      });
    });
  }

  async mockAuthStatus(authenticated) {
    await this.page.route("**/auth/status", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: authenticated,
          user: authenticated ? { id: "123456789", username: "TestUser" } : null,
          timestamp: Date.now(),
        }),
      });
    });
  }
}

module.exports = { DashboardPage };
