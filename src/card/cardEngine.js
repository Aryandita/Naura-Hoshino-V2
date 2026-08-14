"use strict";

const crypto = require("crypto");
const redisManager = require("../managers/redisManager");
const UserCard = require("../models/UserCard");
const { logger } = require("../managers/logger");

const CHARACTERS_CATALOG = [
  { id: "hoshino", name: "Hoshino Takanashi", series: "Blue Archive", rarity: "SECRET_MYTHIC", burnValue: 500 },
  { id: "arona", name: "Arona", series: "Blue Archive", rarity: "ULTRA_RARE", burnValue: 350 },
  { id: "frieren", name: "Frieren", series: "Sousou no Frieren", rarity: "SECRET_MYTHIC", burnValue: 500 },
  { id: "fern", name: "Fern", series: "Sousou no Frieren", rarity: "ULTRA_RARE", burnValue: 300 },
  { id: "megumin", name: "Megumin", series: "KonoSuba", rarity: "ULTRA_RARE", burnValue: 300 },
  { id: "aqua", name: "Aqua", series: "KonoSuba", rarity: "RARE", burnValue: 200 },
  { id: "gojo", name: "Gojo Satoru", series: "Jujutsu Kaisen", rarity: "SECRET_MYTHIC", burnValue: 500 },
  { id: "anya", name: "Anya Forger", series: "Spy x Family", rarity: "RARE", burnValue: 200 },
  { id: "yor", name: "Yor Forger", series: "Spy x Family", rarity: "ULTRA_RARE", burnValue: 300 },
  { id: "rem", name: "Rem", series: "Re:Zero", rarity: "ULTRA_RARE", burnValue: 350 },
  { id: "emilia", name: "Emilia", series: "Re:Zero", rarity: "ULTRA_RARE", burnValue: 300 },
  { id: "hutao", name: "Hu Tao", series: "Genshin Impact", rarity: "SECRET_MYTHIC", burnValue: 500 },
  { id: "furina", name: "Furina", series: "Genshin Impact", rarity: "SECRET_MYTHIC", burnValue: 500 },
  { id: "raiden", name: "Raiden Shogun", series: "Genshin Impact", rarity: "SECRET_MYTHIC", burnValue: 500 },
  { id: "march7", name: "March 7th", series: "Honkai: Star Rail", rarity: "RARE", burnValue: 200 },
  { id: "kafka", name: "Kafka", series: "Honkai: Star Rail", rarity: "SECRET_MYTHIC", burnValue: 500 },
];

class CardEngine {
  static getCatalog() {
    return CHARACTERS_CATALOG;
  }

  static generateCardCode() {
    const chars = "23456789abcdefghjkmnpqrstuvwxyz";
    let code = "nra-";
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  static rollQuality() {
    const roll = Math.random() * 100;
    if (roll < 5) return "GEM_MINT";
    if (roll < 30) return "EXCELLENT";
    if (roll < 80) return "GOOD";
    return "POOR";
  }

  /**
   * Cetak kartu baru dengan serial print number atomik
   */
  static async mintCard(characterId, userId) {
    const charData = CHARACTERS_CATALOG.find((c) => c.id === characterId) || CHARACTERS_CATALOG[0];

    // Atomic Print Number Increment via Redis
    let printNumber = 1;
    if (redisManager.isReady) {
      const redisKey = `card:print_counter:${characterId}`;
      printNumber = await redisManager.client.incr(redisKey);
    } else {
      const count = await UserCard.count({ where: { cardId: characterId } });
      printNumber = count + 1;
    }

    const cardCode = this.generateCardCode();
    const quality = this.rollQuality();

    const newCard = await UserCard.create({
      cardCode,
      userId,
      cardId: charData.id,
      cardName: charData.name,
      characterName: charData.name,
      seriesName: charData.series,
      rarity: charData.rarity,
      printNumber,
      quality,
      frame: "DEFAULT",
      dyeColor: null,
      burnValue: charData.burnValue,
    });

    logger.info(`[CardEngine] Minted: ${charData.name} #${printNumber} (${quality}) for user ${userId} [${cardCode}]`);
    return newCard.toJSON();
  }

  /**
   * Spawn 3 kartu untuk chat drop
   */
  static async createDropSession(channelId) {
    const shuffled = [...CHARACTERS_CATALOG].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);
    const dropId = `drop_${Date.now()}`;

    const sessionData = {
      dropId,
      channelId,
      cards: selected.map((c, idx) => ({ index: idx, id: c.id, name: c.name, series: c.series, claimedBy: null })),
      createdAt: Date.now(),
    };

    if (redisManager.isReady) {
      await redisManager.setCache(`card:drop:${channelId}`, JSON.stringify(sessionData), 60);
    }

    return sessionData;
  }

  /**
   * Klaim kartu dari sesi chat drop
   */
  static async claimDropCard(channelId, cardIndex, userId) {
    if (!redisManager.isReady) return { success: false, reason: "REDIS_UNAVAILABLE" };

    const cacheKey = `card:drop:${channelId}`;
    const rawData = await redisManager.getCache(cacheKey);
    if (!rawData) return { success: false, reason: "DROP_EXPIRED" };

    const session = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
    const cardEntry = session.cards[cardIndex];

    if (!cardEntry) return { success: false, reason: "INVALID_CARD_INDEX" };
    if (cardEntry.claimedBy) return { success: false, reason: "ALREADY_CLAIMED", claimedBy: cardEntry.claimedBy };

    // Set claimed
    cardEntry.claimedBy = userId;
    await redisManager.setCache(cacheKey, JSON.stringify(session), 60);

    // Mint card ke inventory user
    const minted = await this.mintCard(cardEntry.id, userId);

    return {
      success: true,
      card: minted,
    };
  }
}

module.exports = CardEngine;
