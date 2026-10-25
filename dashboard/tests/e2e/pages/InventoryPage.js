"use strict";

class InventoryPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/inventory");
  }

  async getItemsList() {
    return this.page.locator(".inventory-item, .item-card, [data-item-id]");
  }

  async getItemCount() {
    const items = await this.getItemsList();
    return items.count();
  }

  async clickItem(index) {
    const items = await this.getItemsList();
    await items.nth(index).click();
  }

  async getSellButton() {
    return this.page.locator("button:has-text(\"Jual\"), button:has-text(\"Sell\"), .sell-btn");
  }

  async getTrashButton() {
    return this.page.locator("button:has-text(\"Buang\"), button:has-text(\"Trash\"), .trash-btn");
  }

  async mockInventoryAPI(items) {
    await this.page.route("**/api/inventory", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          isGuest: false,
          items: items || [
            { id: "wood", slotIndex: 0, name: "Kayu", icon: "??", type: "Material", rarity: "Common", durability: "100/100", value: "50 NSF", count: 5, desc: "Bahan dasar crafting." },
            { id: "stone", slotIndex: 1, name: "Batu", icon: "??", type: "Material", rarity: "Common", durability: "100/100", value: "75 NSF", count: 3, desc: "Bahan bangunan." },
          ],
          tools: {
            pickaxe: { level: 1, durability: 100, maxDurability: 100 },
            axe: { level: 1, durability: 100, maxDurability: 100 },
            rod: { level: 1, durability: 100, maxDurability: 100 },
          },
          capacity: { used: 2, max: 30 },
        }),
      });
    });
  }

  async mockInventoryAction(success, message) {
    await this.page.route("**/api/inventory/action", (route) => {
      route.fulfill({
        status: success ? 200 : 400,
        contentType: "application/json",
        body: JSON.stringify({
          success: success,
          message: message || (success ? "Item berhasil dijual!" : "Gagal memproses item."),
        }),
      });
    });
  }

  async mockUserProfile(balance) {
    await this.page.route("**/api/me", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          loggedIn: true,
          user: { id: "123456789", username: "TestUser" },
          db: { economy_wallet: balance || 1000, economy_bank: 5000 },
          survival: { starFragments: 500, hp: 100, stamina: 100 },
          isOwner: false,
        }),
      });
    });
  }
}

module.exports = { InventoryPage };
