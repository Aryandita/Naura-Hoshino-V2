const CanvasAsset = require("../models/CanvasAsset");
const GameItem = require("../models/GameItem");
const { logger } = require("./logger");

/**
 * Seed data default ke database jika belum ada (pertama kali setup).
 * Dipisah dari connectToDatabase() agar mudah di-test dan tidak bercampur dengan logic koneksi.
 */
const seedInitialData = async () => {
  try {
    const backgroundCount = await CanvasAsset.count();
    if (backgroundCount === 0) {
      await CanvasAsset.bulkCreate([
        {
          name: "Abstract Blue",
          type: "background",
          url: "https://i.imgur.com/7b1YjK3.png",
          price: 100,
          isPremiumOnly: false,
        },
        {
          name: "Neon Cyberpunk",
          type: "background",
          url: "https://i.imgur.com/k4QYjK3.png",
          price: 500,
          isPremiumOnly: false,
        },
        {
          name: "Gold VIP",
          type: "background",
          url: "https://i.imgur.com/a4QYjK3.png",
          price: 0,
          isPremiumOnly: true,
        },
        {
          name: "Silver Frame",
          type: "border",
          url: "https://i.imgur.com/c4QYjK3.png",
          price: 200,
          isPremiumOnly: false,
        },
      ]);
      logger.db("Default Canvas Assets seeded.");
    }
  } catch (e) {
    logger.error("[DB] Failed to seed Canvas Assets", e);
  }

  try {
    const itemCount = await GameItem.count();
    if (itemCount === 0) {
      const staticItems = require("../../plugin/survival/items_static");
      const bulkData = staticItems.map((item) => {
        const {
          id,
          name,
          description,
          price,
          sellPrice,
          category,
          rarity,
          ...attributes
        } = item;
        return {
          id,
          name,
          description: description || "",
          price: price || 0,
          sellPrice: sellPrice || 0,
          category: category || "material",
          rarity: rarity || "Biasa",
          attributes: attributes || {},
        };
      });
      await GameItem.bulkCreate(bulkData, { ignoreDuplicates: true });
      logger.db("Default Game Items seeded.");
    }
  } catch (e) {
    logger.error("[DB] Failed to seed Game Items", e);
  }
};

module.exports = { seedInitialData };
