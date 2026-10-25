"use strict";

const { logger } = require("../../managers/logger");
const redisManager = require("../../managers/redisManager");

const TREASURE_TYPES = ["common", "rare", "epic", "legendary"];
const DIG_LAYERS = 5;

class TreasureHuntEngine {
  static generateTreasureMap(difficulty = "normal") {
    const clues = [
      "Di bawah pohon tua yang menangis, harta tersembunyi menunggu.",
      "Ikuti aliran sungai ke utara hingga menemukan batu berbentuk hati.",
      "Saat bayangan menara menyentuh sumur, galilah di sana.",
      "Tiga langkah ke timur dari patung pahlawan, dua langkah ke selatan.",
      "Cari reruntuhan yang ditumbuhi lumut merah di hutan terlarang.",
    ];

    const locations = ["forest_ruins", "desert_oasis", "mountain_cave", "sunken_ship", "ancient_temple"];
    const selectedClue = clues[Math.floor(Math.random() * clues.length)];
    const selectedLocation = locations[Math.floor(Math.random() * locations.length)];

    return {
      mapId: `map_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      clue: selectedClue,
      location: selectedLocation,
      difficulty,
      layersRemaining: DIG_LAYERS,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    };
  }

  static async startHunt(userId, treasureMap) {
    try {
      const key = `treasure_hunt:${userId}`;
      await redisManager.set(key, JSON.stringify({ ...treasureMap, userId, startedAt: Date.now() }), "EX", 86400);
      logger.info(`[TreasureHunt] ${userId} started hunt at ${treasureMap.location}`);
      return { ok: true, mapId: treasureMap.mapId };
    } catch (error) {
      logger.error(`[TreasureHunt] Start error:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async digLayer(userId) {
    try {
      const key = `treasure_hunt:${userId}`;
      const raw = await redisManager.get(key);
      if (!raw) return { ok: false, reason: "NO_ACTIVE_HUNT" };

      const hunt = JSON.parse(raw);
      if (hunt.layersRemaining <= 0) return { ok: false, reason: "ALREADY_COMPLETE" };

      hunt.layersRemaining--;
      const foundSomething = Math.random() < 0.3;
      const layerResult = foundSomething ? this._generateLayerFind(hunt.difficulty) : null;

      if (hunt.layersRemaining === 0) {
        const finalLoot = this._generateFinalLoot(hunt.difficulty);
        await redisManager.del(key);
        logger.info(`[TreasureHunt] ${userId} completed hunt`);
        return { ok: true, completed: true, layerResult, finalLoot, layersRemaining: 0 };
      }

      await redisManager.set(key, JSON.stringify(hunt), "EX", 86400);
      return { ok: true, completed: false, layerResult, layersRemaining: hunt.layersRemaining };
    } catch (error) {
      logger.error(`[TreasureHunt] Dig error:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static _generateLayerFind(difficulty) {
    const finds = [
      { name: "Koin Kuno", type: "currency", value: 50 },
      { name: "Pecahan Keramik", type: "artifact_fragment", value: 25 },
      { name: "Tulang Dinosaurus Kecil", type: "fossil", value: 75 },
    ];
    return finds[Math.floor(Math.random() * finds.length)];
  }

  static _generateFinalLoot(difficulty) {
    const multiplier = { normal: 1, hard: 2, extreme: 4 }[difficulty] || 1;
    const artifacts = [
      { name: "Mahkota Raja Hilang", rarity: "legendary", value: 5000 * multiplier },
      { name: "Pedang Perak Kuno", rarity: "epic", value: 2000 * multiplier },
      { name: "Permata Laut Dalam", rarity: "rare", value: 800 * multiplier },
      { name: "Patung Miniatur Emas", rarity: "uncommon", value: 300 * multiplier },
    ];
    return artifacts[Math.floor(Math.random() * artifacts.length)];
  }
}

module.exports = { TreasureHuntEngine, TREASURE_TYPES, DIG_LAYERS };
