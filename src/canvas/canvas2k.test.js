"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const { renderItemCard } = require("./itemCardCanvas");
const { renderRoomCanvas } = require("./roomCanvas");
const { generateInventoryBackpackImage } = require("./inventoryCanvas");

describe("High-Fidelity 2K Canvas Visuals & Multi-Format Rendering", () => {
  const mockItem = {
    id: "cosmic_blade",
    name: "Cosmic Nebula Blade",
    category: "weapon",
    tier: 5,
    tierColor: "#EC4899",
    rarity: "Mythic",
    description:
      "Pedang tempaan inti galaksi dengan radiasi energi kosmik murni.",
    price: 3500,
    sellPrice: 2800,
    stats: { ATK: 250, CRIT: 35 },
  };

  const mockRoom = {
    displayName: "HoshinoArchitect",
    level: 3,
    comfortScore: 480,
    likesCount: 24,
    theme: "cyberpunk",
  };

  const mockUser = {
    id: "user_test_2k",
    username: "HoshinoPlayer",
    displayName: "Hoshino Player",
  };

  it("renderItemCard renders standard PNG and 2K WebP buffer", async () => {
    // 1. Standard PNG
    const pngBuf = await renderItemCard(mockItem, { resolution: "standard" });
    assert.ok(Buffer.isBuffer(pngBuf));
    assert.ok(pngBuf.length > 1000);

    // 2. 2K Resolution WebP
    const webpBuf = await renderItemCard(mockItem, {
      resolution: "2k",
      format: "webp",
    });
    assert.ok(Buffer.isBuffer(webpBuf));
    assert.ok(webpBuf.length > 1000);
  });

  it("renderRoomCanvas renders 2K high-fidelity buffer cleanly", async () => {
    const roomBuf2k = await renderRoomCanvas(mockRoom, mockUser, null, {
      resolution: "2k",
      format: "webp",
    });
    assert.ok(Buffer.isBuffer(roomBuf2k));
    assert.ok(roomBuf2k.length > 1000);
  });

  it("generateInventoryBackpackImage renders 2K resolution buffer", async () => {
    const mockInventory = [
      { id: "cosmic_ore", name: "Bijih Kristal Kosmik", amount: 15 },
      { id: "golden_wood", name: "Kayu Jati Emas", amount: 40 },
    ];
    const mockProfile = {
      leveling_level: 20,
      economy_wallet: 15000,
    };

    const inv2k = await generateInventoryBackpackImage(
      mockUser,
      mockInventory,
      mockProfile,
      {
        resolution: "2k",
        format: "webp",
      },
    );
    assert.ok(Buffer.isBuffer(inv2k));
    assert.ok(inv2k.length > 1000);
  });
});
