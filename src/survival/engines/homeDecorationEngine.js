"use strict";

const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");

const MAX_FURNITURE_SLOTS = 20;
const FURNITURE_CATALOG = [
  { id: "chair_basic", name: "Kursi Kayu", price: 100, type: "seating" },
  { id: "table_round", name: "Meja Bundar", price: 200, type: "table" },
  { id: "lamp_hanging", name: "Lampu Gantung", price: 150, type: "lighting" },
  { id: "rug_ornate", name: "Karpet Hias", price: 300, type: "decoration" },
  { id: "bookshelf_tall", name: "Rak Buku Tinggi", price: 400, type: "storage" },
  { id: "painting_landscape", name: "Lukisan Pemandangan", price: 500, type: "wall_art" },
  { id: "plant_bonsai", name: "Bonsai Mini", price: 250, type: "plant" },
  { id: "bed_canopy", name: "Tempat Tidur Kanopi", price: 800, type: "bedroom" },
];

class HomeDecorationEngine {
  static async placeFurniture(userId, furnitureId, slotIndex) {
    try {
      if (slotIndex < 0 || slotIndex >= MAX_FURNITURE_SLOTS) {
        return { ok: false, reason: "INVALID_SLOT" };
      }

      const item = FURNITURE_CATALOG.find((f) => f.id === furnitureId);
      if (!item) return { ok: false, reason: "ITEM_NOT_FOUND" };

      const survival = await cacheManager.getUserSurvival(userId);
      const furniture = survival?.homeFurniture || {};
      furniture[slotIndex] = { ...item, placedAt: Date.now() };

      await cacheManager.updateUserSurvival(userId, { homeFurniture: furniture });
      logger.info(`[HomeDecor] ${userId} placed ${furnitureId} at slot ${slotIndex}`);
      return { ok: true, slotIndex };
    } catch (error) {
      logger.error(`[HomeDecor] Place error:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async removeFurniture(userId, slotIndex) {
    try {
      const survival = await cacheManager.getUserSurvival(userId);
      const furniture = survival?.homeFurniture || {};
      delete furniture[slotIndex];
      await cacheManager.updateUserSurvival(userId, { homeFurniture: furniture });
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async visitHome(visitorId, ownerId) {
    try {
      const ownerData = await cacheManager.getUserSurvival(ownerId);
      const furniture = ownerData?.homeFurniture || {};
      const furnitureCount = Object.keys(furniture).length;

      return {
        ok: true,
        ownerId,
        furnitureCount,
        furniture,
        rating: ownerData?.homeRating || 0,
      };
    } catch (error) {
      return { ok: false, reason: "HOME_NOT_FOUND" };
    }
  }

  static async rateHome(raterId, ownerId, rating) {
    try {
      if (rating < 1 || rating > 5) return { ok: false, reason: "INVALID_RATING" };
      if (raterId === ownerId) return { ok: false, reason: "SELF_RATE" };

      const ownerData = await cacheManager.getUserSurvival(ownerId);
      const currentRating = ownerData?.homeRating || 0;
      const totalRaters = ownerData?.homeRaterCount || 0;
      const newRating = Math.round(((currentRating * totalRaters) + rating) / (totalRaters + 1));

      await cacheManager.updateUserSurvival(ownerId, { homeRating: newRating, homeRaterCount: totalRaters + 1 });
      return { ok: true, newRating };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static getCatalog() {
    return [...FURNITURE_CATALOG];
  }
}

module.exports = { HomeDecorationEngine, MAX_FURNITURE_SLOTS, FURNITURE_CATALOG };
