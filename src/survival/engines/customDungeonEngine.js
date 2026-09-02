"use strict";

const CommunityDungeon = require("../../models/CommunityDungeon");
const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");

class CustomDungeonEngine {
  /**
   * Membuat dungeon kustom baru oleh pemain
   */
  async createDungeon(creatorUserId, guildId, { dungeonName, theme, rooms, entryFee = 100, initialVault = 500 }) {
    if (!dungeonName || dungeonName.trim().length < 3) {
      return { success: false, reason: "INVALID_NAME" };
    }

    if (!Array.isArray(rooms) || rooms.length < 3 || rooms.length > 10) {
      return { success: false, reason: "INVALID_ROOM_COUNT", min: 3, max: 10 };
    }

    if (entryFee < 50) {
      return { success: false, reason: "MIN_ENTRY_FEE", min: 50 };
    }

    // Potong modal brankas hadiah awal dari dompet kreator
    const totalCost = Number(initialVault);
    const debit = await cacheManager.debitUserProfile(
      creatorUserId,
      "economy_wallet",
      totalCost,
    );
    if (!debit.ok) {
      return {
        success: false,
        reason: "INSUFFICIENT_FUNDS",
        required: totalCost,
      };
    }

    const dungeonId = `cd_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const dungeon = await CommunityDungeon.create({
      dungeonId,
      creatorUserId,
      guildId,
      dungeonName: dungeonName.trim(),
      theme: theme || "CYBER_VOID",
      roomsConfig: rooms,
      entryFee,
      vaultBalance: initialVault,
      ratingAverage: 5.0,
      totalPlays: 0,
      totalClears: 0,
    });

    logger.info(
      `[CustomDungeon] User ${creatorUserId} membuat dungeon baru: "${dungeonName}" (ID: ${dungeonId})`,
    );

    return {
      success: true,
      dungeon,
    };
  }

  /**
   * Cari dan tampilkan daftar dungeon komunitas di server
   */
  async browseDungeons(guildId, limit = 5) {
    try {
      const dungeons = await CommunityDungeon.findAll({
        where: { guildId },
        order: [["ratingAverage", "DESC"], ["totalPlays", "DESC"]],
        limit,
      });
      return dungeons;
    } catch (e) {
      return [];
    }
  }

  /**
   * Ambil detail dungeon berdasarkan ID
   */
  async getDungeonById(dungeonId) {
    return await CommunityDungeon.findOne({ where: { dungeonId } });
  }

  /**
   * Menantang & menjelajahi dungeon komunitas
   */
  async playDungeon(userId, dungeonId, playerCombatPower = 150) {
    const dungeon = await this.getDungeonById(dungeonId);
    if (!dungeon) return { success: false, reason: "DUNGEON_NOT_FOUND" };

    // Bayar tiket masuk ke brankas dungeon
    const fee = Number(dungeon.entryFee);
    const debit = await cacheManager.debitUserProfile(
      userId,
      "economy_wallet",
      fee,
    );
    if (!debit.ok) {
      return { success: false, reason: "INSUFFICIENT_FUNDS", fee };
    }

    // 5% royalti masuk brankas kreator, 95% masuk pool hadiah tantangan
    const royalty = Math.round(fee * 0.05);
    const poolContribution = fee - royalty;

    const rooms = Array.isArray(dungeon.roomsConfig) ? dungeon.roomsConfig : [];
    let currentRoom = 0;
    let survived = true;
    let totalHpLost = 0;

    for (const room of rooms) {
      currentRoom++;
      const difficulty = room.difficulty || 50;
      const monsterHp = room.monsterHp || 100;

      // Simulasi pertarungan berbasis combat power
      if (playerCombatPower < difficulty * 0.5) {
        survived = false;
        totalHpLost += 150;
        break;
      } else {
        totalHpLost += Math.max(10, Math.floor(difficulty * 0.3));
      }
    }

    await CommunityDungeon.increment("totalPlays", {
      by: 1,
      where: { dungeonId },
    });
    await CommunityDungeon.increment("vaultBalance", {
      by: royalty,
      where: { dungeonId },
    });

    if (survived) {
      await CommunityDungeon.increment("totalClears", {
        by: 1,
        where: { dungeonId },
      });

      // Hadiah: 2x tiket masuk + bonus fragment
      const rewardCoins = fee * 2;
      await cacheManager.incrementUserProfile(
        userId,
        "economy_wallet",
        rewardCoins,
      );

      return {
        success: true,
        cleared: true,
        roomsCleared: rooms.length,
        totalRooms: rooms.length,
        rewardCoins,
        hpLost: totalHpLost,
      };
    } else {
      return {
        success: true,
        cleared: false,
        roomsCleared: currentRoom - 1,
        totalRooms: rooms.length,
        hpLost: totalHpLost,
      };
    }
  }

  /**
   * Memberikan rating bintang ke dungeon
   */
  async rateDungeon(dungeonId, ratingScore) {
    const dungeon = await this.getDungeonById(dungeonId);
    if (!dungeon) return { success: false, reason: "NOT_FOUND" };

    const score = Math.max(1, Math.min(5, Number(ratingScore) || 5));
    const currentRating = Number(dungeon.ratingAverage) || 5.0;
    const plays = Number(dungeon.totalPlays) || 1;

    const newRating = Number(
      ((currentRating * plays + score) / (plays + 1)).toFixed(1),
    );

    await CommunityDungeon.update(
      { ratingAverage: newRating },
      { where: { dungeonId } },
    );

    return { success: true, newRating };
  }

  /**
   * Kreator mencairkan royalti brankas dungeon
   */
  async withdrawVault(creatorUserId, dungeonId) {
    const dungeon = await this.getDungeonById(dungeonId);
    if (!dungeon) return { success: false, reason: "NOT_FOUND" };
    if (dungeon.creatorUserId !== creatorUserId) {
      return { success: false, reason: "NOT_CREATOR" };
    }

    const amount = Number(dungeon.vaultBalance);
    if (amount <= 0) {
      return { success: false, reason: "EMPTY_VAULT" };
    }

    await dungeon.update({ vaultBalance: 0 });
    await cacheManager.incrementUserProfile(
      creatorUserId,
      "economy_wallet",
      amount,
    );

    return {
      success: true,
      withdrawnAmount: amount,
    };
  }
}

module.exports = new CustomDungeonEngine();
