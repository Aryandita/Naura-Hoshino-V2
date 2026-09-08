"use strict";

const UserCafe = require("../../models/UserCafe");
const { CAFE_RECIPES, getRecipeById } = require("../data/cafeRecipes");
const cacheManager = require("../../managers/cacheManager");
const inventoryHelper = require("../engines/inventoryHelper");
const { logger } = require("../../managers/logger");

class CafeEngine {
  /**
   * Buka atau ambil status kafe pemain
   */
  static async openOrGetCafe(userId, username = "Petualang") {
    const [cafe, created] = await UserCafe.findOrCreate({
      where: { userId },
      defaults: {
        userId,
        cafeName: `Kafe ${username}`,
        level: 1,
        reputation: 0,
        unlockedRecipes: ["sakura_latte", "cyber_ramen"],
        activeDishes: {},
        theme: "CYBER_NEON",
        customersServed: 0,
        uncollectedRevenue: 0,
        lastCollectedAt: new Date(),
      },
    });

    // Hitung akumulasi pendapatan idle sejak klaim terakhir
    const now = Date.now();
    const lastTime = new Date(cafe.lastCollectedAt).getTime();
    const hoursPassed = Math.min(
      24,
      Math.max(0, (now - lastTime) / (1000 * 60 * 60)),
    );

    if (hoursPassed >= 0.1) {
      const hourlyRate =
        (cafe.level || 1) * 35 + Math.floor((cafe.reputation || 0) * 0.5);
      const newRevenue = Math.floor(hoursPassed * hourlyRate);
      if (newRevenue > 0) {
        cafe.uncollectedRevenue =
          Number(cafe.uncollectedRevenue || 0) + newRevenue;
        cafe.lastCollectedAt = new Date();
        await cafe.save({ fields: ["uncollectedRevenue", "lastCollectedAt"] });
      }
    }

    if (created) {
      logger.info(
        `[CafeEngine] Kafe baru dibuka untuk ${userId} (${cafe.cafeName})`,
      );
    }

    return cafe.toJSON();
  }

  /**
   * Masak menu dari bahan mentah survival
   */
  static async cookRecipe(userId, recipeId, quantity = 1) {
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const recipe = getRecipeById(recipeId);
    if (!recipe) return { success: false, reason: "RECIPE_NOT_FOUND" };

    const cafe = await UserCafe.findByPk(userId);
    if (!cafe) return { success: false, reason: "NO_CAFE" };

    const unlocked = cafe.unlockedRecipes || ["sakura_latte", "cyber_ramen"];
    if (!unlocked.includes(recipeId)) {
      return {
        success: false,
        reason: "RECIPE_LOCKED",
        requiredLevel: recipe.requiredLevel,
      };
    }

    // Ambil bahan mentah secara atomik dari inventaris UserProfile
    const takeRequests = recipe.ingredients.map((ing) => ({
      id: ing.id,
      amount: ing.amount * qty,
    }));

    const takeResult = await inventoryHelper.takeItemsAtomic(
      userId,
      takeRequests,
    );
    if (!takeResult.ok) {
      return {
        success: false,
        reason: "INSUFFICIENT_INGREDIENTS",
        missingItem: recipe.ingredients[0].name || recipe.ingredients[0].id,
      };
    }

    // Tambahkan hidangan ke etalase aktif kafe
    const dishes = cafe.activeDishes || {};
    dishes[recipeId] = Number(dishes[recipeId] || 0) + qty;
    cafe.activeDishes = dishes;
    cafe.changed("activeDishes", true);

    // Tambah reputasi kafe
    const repGain = 10 * qty;
    const newRep = Number(cafe.reputation || 0) + repGain;
    cafe.reputation = newRep;

    // Evaluasi Level Up Kafe
    let levelUp = false;
    const nextLevelReq = cafe.level * 100;
    if (newRep >= nextLevelReq && cafe.level < 10) {
      cafe.level += 1;
      levelUp = true;
      // Buka resep baru sesuai level
      const newRecipes = CAFE_RECIPES.filter(
        (r) => r.requiredLevel <= cafe.level,
      ).map((r) => r.id);
      cafe.unlockedRecipes = Array.from(new Set([...unlocked, ...newRecipes]));
    }

    await cafe.save({
      fields: ["activeDishes", "reputation", "level", "unlockedRecipes"],
    });

    logger.info(
      `[CafeEngine] User ${userId} memasak ${qty}x ${recipe.name}. Reputasi: +${repGain}`,
    );
    return {
      success: true,
      dishName: recipe.name,
      emoji: recipe.emoji,
      quantity: qty,
      totalStock: dishes[recipeId],
      repGain,
      currentRep: newRep,
      levelUp,
      newLevel: cafe.level,
      buff: recipe.buff,
    };
  }

  /**
   * Layani pelanggan NPC yang datang ke kafe
   */
  static async serveNpcCustomers(userId) {
    const cafe = await UserCafe.findByPk(userId);
    if (!cafe) return { success: false, reason: "NO_CAFE" };

    const dishes = cafe.activeDishes || {};
    const availableDishKeys = Object.keys(dishes).filter(
      (k) => Number(dishes[k]) > 0,
    );

    if (availableDishKeys.length === 0) {
      return { success: false, reason: "NO_FOOD_IN_STOCK" };
    }

    // NPC membeli 1-3 porsi makanan acak dari etalase
    const chosenKey =
      availableDishKeys[Math.floor(Math.random() * availableDishKeys.length)];
    const recipe = getRecipeById(chosenKey);
    const maxCanSell = Math.min(3, Number(dishes[chosenKey]));
    const sellQty = Math.floor(Math.random() * maxCanSell) + 1;

    dishes[chosenKey] = Number(dishes[chosenKey]) - sellQty;
    cafe.activeDishes = dishes;
    cafe.changed("activeDishes", true);

    const pricePerDish = recipe ? recipe.price : 200;
    const totalEarned = pricePerDish * sellQty;
    const tips = Math.floor(Math.random() * 25) + 10;
    const finalEarnings = totalEarned + tips;

    cafe.customersServed = Number(cafe.customersServed || 0) + 1;
    await cafe.save({ fields: ["activeDishes", "customersServed"] });

    // Tambahkan saldo ke pemain lewat cacheManager
    await cacheManager.incrementUserSurvival(
      userId,
      "starFragments",
      finalEarnings,
    );

    return {
      success: true,
      dishName: recipe ? recipe.name : chosenKey,
      emoji: recipe ? recipe.emoji : "🍽️",
      soldQuantity: sellQty,
      earnings: finalEarnings,
      tips,
      remainingStock: dishes[chosenKey],
      customersServed: cafe.customersServed,
    };
  }

  /**
   * Klaim pendapatan pasif idle kafe
   */
  static async collectIdleRevenue(userId) {
    const cafe = await UserCafe.findByPk(userId);
    if (!cafe) return { success: false, reason: "NO_CAFE" };

    // Hitung ulang akumulasi terkini
    const now = Date.now();
    const lastTime = new Date(cafe.lastCollectedAt).getTime();
    const hoursPassed = Math.min(
      24,
      Math.max(0, (now - lastTime) / (1000 * 60 * 60)),
    );
    const hourlyRate =
      (cafe.level || 1) * 35 + Math.floor((cafe.reputation || 0) * 0.5);
    const addedRevenue = Math.floor(hoursPassed * hourlyRate);

    const totalToCollect = Number(cafe.uncollectedRevenue || 0) + addedRevenue;
    if (totalToCollect <= 0) {
      return { success: false, reason: "NOTHING_TO_COLLECT" };
    }

    cafe.uncollectedRevenue = 0;
    cafe.lastCollectedAt = new Date();
    await cafe.save({ fields: ["uncollectedRevenue", "lastCollectedAt"] });

    await cacheManager.incrementUserSurvival(
      userId,
      "starFragments",
      totalToCollect,
    );

    try {
      await cacheManager.mutateUserProfileJson(
        userId,
        "notification_prefs",
        (cur) => {
          const obj = cur && typeof cur === "object" ? cur : {};
          obj.sent_idle_revenue = false;
          return obj;
        },
      );
    } catch {}

    logger.info(
      `[CafeEngine] User ${userId} mengklaim ${totalToCollect} Star Fragments pendapatan idle.`,
    );
    return {
      success: true,
      collectedAmount: totalToCollect,
      cafeName: cafe.cafeName,
      level: cafe.level,
    };
  }

  /**
   * Beli makanan langsung dari kafe pemain lain (P2P Social Cafe)
   */
  static async orderDishFromUser(
    buyerId,
    sellerId,
    recipeId,
    buyerUsername = "Pembeli",
  ) {
    if (buyerId === sellerId) {
      return { success: false, reason: "CANNOT_ORDER_FROM_SELF" };
    }

    const sellerCafe = await UserCafe.findByPk(sellerId);
    if (!sellerCafe) return { success: false, reason: "SELLER_NO_CAFE" };

    const dishes = sellerCafe.activeDishes || {};
    const stock = Number(dishes[recipeId] || 0);
    if (stock <= 0) return { success: false, reason: "OUT_OF_STOCK" };

    const recipe = getRecipeById(recipeId);
    if (!recipe) return { success: false, reason: "RECIPE_NOT_FOUND" };

    // Debit saldo pembeli
    const debit = await cacheManager.debitUserSurvival(
      buyerId,
      "starFragments",
      recipe.price,
    );
    if (!debit.ok) {
      const buyerSurvival = await cacheManager.getUserSurvival(buyerId);
      return {
        success: false,
        reason: "INSUFFICIENT_FUNDS",
        price: recipe.price,
        balance: buyerSurvival ? Number(buyerSurvival.starFragments || 0) : 0,
      };
    }

    // Kurangi stok penjual & transfer koin
    dishes[recipeId] = stock - 1;
    sellerCafe.activeDishes = dishes;
    sellerCafe.customersServed = Number(sellerCafe.customersServed || 0) + 1;
    sellerCafe.reputation = Number(sellerCafe.reputation || 0) + 5;
    sellerCafe.changed("activeDishes", true);
    await sellerCafe.save({
      fields: ["activeDishes", "customersServed", "reputation"],
    });

    await cacheManager.incrementUserSurvival(
      sellerId,
      "starFragments",
      recipe.price,
    );

    logger.info(
      `[CafeEngine] User ${buyerId} (${buyerUsername}) memesan ${recipe.name} dari ${sellerId} seharga ${recipe.price}`,
    );
    return {
      success: true,
      dishName: recipe.name,
      emoji: recipe.emoji,
      price: recipe.price,
      sellerCafeName: sellerCafe.cafeName,
      buff: recipe.buff,
    };
  }
}

module.exports = CafeEngine;
