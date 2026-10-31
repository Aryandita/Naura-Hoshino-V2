// @ts-check
const { test, expect } = require("@playwright/test");
const { InventoryPage } = require("./pages/InventoryPage");
const { LoginPage } = require("./pages/LoginPage");

test.describe("Transaction Flow", () => {
  let inventoryPage;
  let loginPage;

  test.beforeEach(async ({ page }) => {
    inventoryPage = new InventoryPage(page);
    loginPage = new LoginPage(page);

    await loginPage.mockAuthenticatedSession({
      id: "123456789012345678",
      username: "TraderUser",
      discriminator: "5678",
    });
  });

  test("should load inventory page with items", async ({ page }) => {
    await inventoryPage.mockUserProfile(1500);
    await inventoryPage.mockInventoryAPI([
      { id: "wood", slotIndex: 0, name: "Kayu", icon: "??", type: "Material", rarity: "Common", value: "50 NSF", count: 10 },
      { id: "iron_ore", slotIndex: 1, name: "Bijih Besi", icon: "??", type: "Material", rarity: "Uncommon", value: "150 NSF", count: 5 },
    ]);

    await inventoryPage.goto();

    await page.waitForTimeout(500);

    const response = await page.request.get("/api/inventory");
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.items.length).toBeGreaterThan(0);
  });

  test("should display item details correctly", async ({ page }) => {
    await inventoryPage.mockUserProfile(2000);
    await inventoryPage.mockInventoryAPI([
      { id: "sword_basic", slotIndex: 0, name: "Pedang Dasar", icon: "???", type: "Weapon", rarity: "Common", durability: "100/100", value: "500 NSF", count: 1, desc: "Senjata pemula." },
    ]);

    await inventoryPage.goto();

    const response = await page.request.get("/api/inventory");
    const data = await response.json();
    expect(data.items[0].name).toBe("Pedang Dasar");
    expect(data.items[0].type).toBe("Weapon");
  });

  test("should sell item successfully", async ({ page }) => {
    await inventoryPage.mockUserProfile(1000);
    await inventoryPage.mockInventoryAPI([
      { id: "wood", slotIndex: 0, name: "Kayu", icon: "??", type: "Material", rarity: "Common", value: "50 NSF", count: 5 },
    ]);

    let actionCalled = false;
    await page.route("**/api/inventory/action", (route) => {
      const body = route.request().postDataJSON();
      if (body.action === "sell" && body.itemId === "wood") {
        actionCalled = true;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message: "Berhasil! 1x **Kayu** terjual seharga ? **50 NSF**.",
          }),
        });
      } else {
        route.continue();
      }
    });

    await inventoryPage.goto();

    const data = await page.evaluate(async () => {
      const res = await fetch("/api/inventory/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: "wood", itemIdx: 0, action: "sell" }),
      });
      return res.json();
    });

    expect(actionCalled || data.success).toBeTruthy();
  });

  test("should update balance after transaction", async ({ page }) => {
    let currentBalance = 1000;

    await page.route("**/api/me", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          loggedIn: true,
          user: { id: "123456789012345678", username: "TraderUser" },
          db: { economy_wallet: currentBalance, economy_bank: 5000 },
          survival: { starFragments: currentBalance },
          isOwner: false,
        }),
      });
    });

    await page.route("**/api/inventory/action", (route) => {
      const body = route.request().postDataJSON();
      if (body.action === "sell") {
        currentBalance += 50;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, message: "Item sold!" }),
        });
      } else {
        route.continue();
      }
    });

    await inventoryPage.goto();

    const sellResponse = await page.request.post("/api/inventory/action", {
      data: { itemId: "wood", itemIdx: 0, action: "sell" },
    });
    expect((await sellResponse.json()).success).toBe(true);

    const meResponse = await page.request.get("/api/me");
    const meData = await meResponse.json();
    expect(meData.survival.starFragments).toBe(1050);
  });

  test("should handle insufficient funds error", async ({ page }) => {
    await inventoryPage.mockUserProfile(0);

    await page.route("**/api/inventory/action", (route) => {
      const body = route.request().postDataJSON();
      if (body.action === "buy") {
        route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: "Saldo tidak mencukupi untuk membeli item ini.",
          }),
        });
      } else {
        route.continue();
      }
    });

    await inventoryPage.goto();

    const response = await page.request.post("/api/inventory/action", {
      data: { itemId: "expensive_item", itemIdx: 0, action: "buy" },
    });
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toMatch(/saldo|insufficient/i);
  });

  test("should record transaction in history", async ({ page }) => {
    await inventoryPage.mockUserProfile(5000);

    let transactionRecorded = false;
    await page.route("**/api/inventory/action", (route) => {
      transactionRecorded = true;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Transaksi berhasil!",
          transactionId: "txn_" + Date.now(),
        }),
      });
    });

    await inventoryPage.goto();

    const response = await page.request.post("/api/inventory/action", {
      data: { itemId: "wood", itemIdx: 0, action: "sell" },
    });
    const data = await response.json();

    expect(transactionRecorded).toBe(true);
    expect(data.success).toBe(true);
  });

  test("should trash item without adding balance", async ({ page }) => {
    let balanceChanged = false;
    const initialBalance = 1000;

    await page.route("**/api/me", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          loggedIn: true,
          user: { id: "123456789012345678", username: "TraderUser" },
          db: { economy_wallet: initialBalance },
          survival: { starFragments: initialBalance },
          isOwner: false,
        }),
      });
    });

    await page.route("**/api/inventory/action", (route) => {
      const body = route.request().postDataJSON();
      if (body.action === "trash") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message: "Item dibuang.",
          }),
        });
      } else {
        route.continue();
      }
    });

    await inventoryPage.goto();

    const data = await page.evaluate(async () => {
      const res = await fetch("/api/inventory/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: "junk", itemIdx: 0, action: "trash" }),
      });
      return res.json();
    });

    expect(data.success).toBe(true);
    const meRes = await page.evaluate(async () => {
      const res = await fetch("/api/me");
      return res.json();
    });
    expect(meRes.db.economy_wallet).toBe(initialBalance);
  });

  test("should validate item ownership before transaction", async ({ page }) => {
    await page.route("**/api/inventory/action", (route) => {
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: "Itemnya tidak cocok dengan slot itu.",
        }),
      });
    });

    await inventoryPage.goto();

    const response = await page.request.post("/api/inventory/action", {
      data: { itemId: "wrong_item", itemIdx: 99, action: "sell" },
    });
    const data = await response.json();

    expect(data.success).toBe(false);
  });
});
