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
          url: "assets/images/canvas/abstract_blue.png",
          price: 100,
          isPremiumOnly: false,
        },
        {
          name: "Neon Cyberpunk",
          type: "background",
          url: "assets/images/canvas/neon_cyberpunk.png",
          price: 500,
          isPremiumOnly: false,
        },
        {
          name: "Gold VIP",
          type: "background",
          url: "assets/images/canvas/gold_vip.png",
          price: 0,
          isPremiumOnly: true,
        },
        {
          name: "Silver Frame",
          type: "border",
          url: "assets/images/canvas/silver_frame.png",
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
      const {
        BALANCED_ITEMS_CATALOG,
      } = require("../survival/data/items_catalog");
      const bulkData = BALANCED_ITEMS_CATALOG.map((item) => {
        const {
          id,
          name,
          description,
          price,
          sellPrice,
          category,
          rarity,
          tier,
          tierColor,
          image,
          emoji,
          iconType,
          ...attributes
        } = item;
        return {
          id,
          name,
          description: description || "",
          price: price || 0,
          sellPrice: sellPrice || 0,
          category: category || "material",
          rarity: rarity || "Common",
          attributes: {
            tier: tier || 1,
            tierColor: tierColor || "#9CA3AF",
            image: image || `/items/${id}.svg`,
            emoji: emoji || "📦",
            iconType: iconType || category,
            ...attributes,
          },
        };
      });
      await GameItem.bulkCreate(bulkData, { ignoreDuplicates: true });
      logger.db("Default 150 Balanced Game Items seeded.");
    }
  } catch (e) {
    logger.error("[DB] Failed to seed Game Items", e);
  }
};

module.exports = { seedInitialData };
