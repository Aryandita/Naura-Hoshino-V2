"use strict";

const WorldBoss = require("../../models/WorldBoss");
const redisManager = require("../../managers/redisManager");
const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");

const BOSS_CACHE_KEY = "survival:world_boss:active";
const RAID_CHANNEL = "survival:raid:events";

class WorldBossEngine {
  /**
   * Ambil data World Boss yang sedang aktif
   */
  static async getActiveBoss() {
    if (redisManager.isReady) {
      const cached = await redisManager.getCache(BOSS_CACHE_KEY);
      if (cached) {
        return typeof cached === "string" ? JSON.parse(cached) : cached;
      }
    }

    const boss = await WorldBoss.findOne({
      where: { status: "ACTIVE" },
      order: [["createdAt", "DESC"]],
    });

    if (boss && redisManager.isReady) {
      await redisManager.setCache(
        BOSS_CACHE_KEY,
        JSON.stringify(boss.toJSON()),
        30,
      );
    }

    return boss ? boss.toJSON() : null;
  }

  /**
   * Spawn World Boss Baru
   */
  static async spawnBoss({
    bossId = `boss_${Date.now()}`,
    name = "Abyssal Leviathan Lord",
    title = "Sang Penguasa Samudera Kehampaan",
    element = "WATER",
    maxHp = 500000,
    durationMinutes = 60,
    rewardsPool = { starFragments: 5000, coupons: 30 },
  } = {}) {
    const endTime = new Date(Date.now() + durationMinutes * 60 * 1000);

    const newBoss = await WorldBoss.create({
      bossId,
      name,
      title,
      element,
      maxHp,
      currentHp: maxHp,
      status: "ACTIVE",
      damageLeaderboard: {},
      rewardsPool,
      spawnTime: new Date(),
      endTime,
    });

    if (redisManager.isReady) {
      await redisManager.setCache(
        BOSS_CACHE_KEY,
        JSON.stringify(newBoss.toJSON()),
        60,
      );
      await redisManager.publish(RAID_CHANNEL, {
        type: "SPAWN",
        boss: newBoss.toJSON(),
      });
    }

    logger.info(`[WorldBoss] Spawned: ${name} (${title}) with ${maxHp} HP`);
    return newBoss.toJSON();
  }

  /**
   * Serang World Boss
   */
  static async attackBoss(
    userId,
    username,
    { userLevel = 1, petBuffs = {} } = {},
  ) {
    const boss = await this.getActiveBoss();
    if (!boss || boss.status !== "ACTIVE") {
      return { success: false, reason: "NO_ACTIVE_BOSS" };
    }

    if (new Date() > new Date(boss.endTime)) {
      await WorldBoss.update(
        { status: "DESPAWNED" },
        { where: { bossId: boss.bossId } },
      );
      if (redisManager.isReady) await redisManager.deleteCache(BOSS_CACHE_KEY);
      return { success: false, reason: "BOSS_EXPIRED" };
    }

    // Hitung damage pemain
    const baseDmg = Math.floor(Math.random() * 80) + 100 + userLevel * 5;
    const petDmgBuff = petBuffs.damage || 0;
    const critBonus =
      Math.random() * 100 < 15 + (petBuffs.crit || 0) ? 1.75 : 1.0;
    const totalDamage = Math.floor((baseDmg + petDmgBuff) * critBonus);
    const isCrit = critBonus > 1.0;

    // Mutasi damage dan leaderboard di DB
    const dbBoss = await WorldBoss.findOne({ where: { bossId: boss.bossId } });
    if (!dbBoss) return { success: false, reason: "BOSS_NOT_FOUND" };

    const newHp = Math.max(0, Number(dbBoss.currentHp) - totalDamage);
    const leaderboard = dbBoss.damageLeaderboard || {};

    if (!leaderboard[userId]) {
      leaderboard[userId] = { userId, username, totalDamage: 0, hits: 0 };
    }
    leaderboard[userId].totalDamage += totalDamage;
    leaderboard[userId].hits += 1;
    leaderboard[userId].username = username;

    dbBoss.currentHp = newHp;
    dbBoss.damageLeaderboard = leaderboard;
    dbBoss.changed("damageLeaderboard", true);

    const isDefeated = newHp <= 0;
    if (isDefeated) {
      dbBoss.status = "DEFEATED";
    }

    await dbBoss.save({
      fields: ["currentHp", "damageLeaderboard", "status"],
    });

    // Invalidate / update Redis
    if (redisManager.isReady) {
      if (isDefeated) {
        await redisManager.deleteCache(BOSS_CACHE_KEY);
        await this._distributeRewards(dbBoss);
      } else {
        await redisManager.setCache(
          BOSS_CACHE_KEY,
          JSON.stringify(dbBoss.toJSON()),
          30,
        );
      }

      await redisManager.publish(RAID_CHANNEL, {
        type: isDefeated ? "DEFEATED" : "ATTACK",
        userId,
        damage: totalDamage,
        currentHp: newHp,
      });
    }

    return {
      success: true,
      damage: totalDamage,
      isCrit,
      bossName: dbBoss.name,
      currentHp: newHp,
      maxHp: dbBoss.maxHp,
      isDefeated,
      userTotalDamage: leaderboard[userId].totalDamage,
    };
  }

  /**
   * Bagikan hadiah raid secara proporsional kepada pemain di leaderboard
   */
  static async _distributeRewards(boss) {
    try {
      const leaderboard = boss.damageLeaderboard || {};
      const participants = Object.values(leaderboard);
      if (participants.length === 0) return;

      const totalPoolFrag = boss.rewardsPool?.starFragments || 5000;
      const totalPoolCoupons = boss.rewardsPool?.coupons || 30;
      const totalDmgDealt =
        participants.reduce((sum, p) => sum + (p.totalDamage || 0), 0) || 1;

      for (const p of participants) {
        const share = p.totalDamage / totalDmgDealt;
        const rewardFrag = Math.max(50, Math.floor(totalPoolFrag * share));
        const rewardCoupons = Math.max(1, Math.floor(totalPoolCoupons * share));

        await cacheManager.incrementUserSurvival(
          p.userId,
          "starFragments",
          rewardFrag,
        );
        await cacheManager.incrementUserSurvival(
          p.userId,
          "coupons",
          rewardCoupons,
        );
        logger.info(
          `[WorldBoss Reward] User ${p.userId} (${p.username}) dapat ${rewardFrag} Fragments, ${rewardCoupons} Coupons.`,
        );
      }
    } catch (e) {
      logger.error("[WorldBoss] Gagal membagikan reward raid:", e);
    }
  }
}

module.exports = WorldBossEngine;
