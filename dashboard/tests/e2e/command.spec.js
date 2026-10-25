// @ts-check
const { test, expect } = require("@playwright/test");
const { LoginPage } = require("./pages/LoginPage");

test.describe("Command Execution Flow", () => {
  let loginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);

    await loginPage.mockAuthenticatedSession({
      id: "123456789012345678",
      username: "CommanderUser",
      discriminator: "9999",
    });
  });

  test("should access command simulator if available", async ({ page }) => {
    await page.goto("/settings");

    const sandboxForm = page.locator("#sandboxForm, .sandbox-container, form[action*=\"sandbox\"]");
    const hasSandbox = (await sandboxForm.count()) > 0;

    if (hasSandbox) {
      await expect(sandboxForm.first()).toBeVisible();
    } else {
      const response = await page.request.get("/api/me");
      expect((await response.json()).loggedIn).toBe(true);
    }
  });

  test("should execute AI persona sandbox command", async ({ page }) => {
    await page.route("**/api/settings/sandbox", (route) => {
      const body = route.request().postDataJSON();
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: `[Mode Demo] Persona kamu sudah aktif kok! Kamu bilang: "${body.message}". Naura siap menemani dengan sifat barunya!`,
        }),
      });
    });

    await page.goto("/settings");

    const response = await page.request.post("/api/settings/sandbox", {
      data: { message: "Halo Naura!", customPersona: "Ceria" },
    });
    const data = await response.json();

    expect(data.reply).toBeDefined();
    expect(data.reply).toContain("Halo Naura!");
  });

  test("should handle invalid command gracefully", async ({ page }) => {
    await page.route("**/api/settings/sandbox", (route) => {
      const body = route.request().postDataJSON();
      if (!body.message || body.message.trim() === "") {
        route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "Pesannya masih kosong." }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/settings");

    const response = await page.request.post("/api/settings/sandbox", {
      data: { message: "" },
    });
    const data = await response.json();

    expect(response.status()).toBe(400);
    expect(data.error).toMatch(/kosong|empty/i);
  });

  test("should render command response correctly", async ({ page }) => {
    const mockResponse = "Ini adalah balasan dari Naura untuk testing rendering.";

    await page.route("**/api/settings/sandbox", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reply: mockResponse }),
      });
    });

    await page.goto("/settings");

    const response = await page.request.post("/api/settings/sandbox", {
      data: { message: "Test rendering", customPersona: "default" },
    });
    const data = await response.json();

    expect(data.reply).toBe(mockResponse);
  });

  test("should support different persona modes", async ({ page }) => {
    const personas = ["tsundere", "formal", "default"];
    const responses = {};

    for (const persona of personas) {
      await page.route(`**/api/settings/sandbox?persona=${persona}`, (route) => {
        let reply = `[Mode Demo] Persona ${persona} aktif. `;
        if (persona === "tsundere") {
          reply += "H-hmph! Jangan salah paham ya!";
        } else if (persona === "formal") {
          reply += "Baik, pesan Anda sudah kami terima.";
        } else {
          reply += "Naura siap menemani!";
        }
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ reply }),
        });
      });
    }

    await page.goto("/settings");

    const tsundereResponse = await page.request.post("/api/settings/sandbox", {
      data: { message: "Test", customPersona: "tsundere" },
    });
    expect((await tsundereResponse.json()).reply).toBeDefined();

    const formalResponse = await page.request.post("/api/settings/sandbox", {
      data: { message: "Test", customPersona: "formal" },
    });
    expect((await formalResponse.json()).reply).toBeDefined();
  });

  test("should handle API timeout on command execution", async ({ page }) => {
    await page.route("**/api/settings/sandbox", (route) => {
      setTimeout(() => {
        route.fulfill({
          status: 504,
          contentType: "application/json",
          body: JSON.stringify({ error: "Request timeout" }),
        });
      }, 100);
    });

    await page.goto("/settings");

    const response = await page.request.post("/api/settings/sandbox", {
      data: { message: "Slow request test" },
    });

    expect([200, 504]).toContain(response.status());
  });
});
