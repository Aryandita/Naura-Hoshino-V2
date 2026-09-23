"use strict";

const WorldBoss = require("../../models/WorldBoss");
const redisManager = require("../../managers/redisManager");
const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");
const ui = require("../../config/ui");

const BOSS_CACHE_KEY = "survival:world_boss:active";
const RAID_CHANNEL = "survival:raid:events";
const BOSS_CACHE_TTL = 120; // 120 detik (2 menit) cache TTL

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
        boss.toJSON(),
        BOSS_CACHE_TTL,
      );
    }

    return boss ? boss.toJSON() : null;
  }

  /**
   * Spawn World Boss Baru dengan sistem multi-fase
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
    const maxShieldHp = Math.floor(maxHp * 0.25); // Shield 25% dari total HP

    const newBoss = await WorldBoss.create({
      bossId,
      name,
      title,
      element,
      phase: 1, // 1: Normal, 2: Shield, 3: Enrage
      maxHp,
      currentHp: maxHp,
      shieldHp: 0,
      maxShieldHp,
      status: "ACTIVE",
      damageLeaderboard: {},
      roleContributions: {
        tanks: {},
        healers: {},
        dps: {},
        buffers: {},
      },
      rewardsPool,
      spawnTime: new Date(),
      endTime,
    });

    if (redisManager.isReady) {
      await redisManager.setCache(
        BOSS_CACHE_KEY,
        JSON.stringify(newBoss.toJSON()),
        BOSS_CACHE_TTL,
      );
      await redisManager.publish(RAID_CHANNEL, {
        type: "SPAWN",
        boss: newBoss.toJSON(),
      });
    }

    logger.info(
      `[WorldBoss 2.0] Spawned: ${name} (${title}) with ${maxHp} HP [Element: ${element}]`,
    );
    return newBoss.toJSON();
  }

  /**
   * Serang World Boss dengan dukungan aksi peran taktis (DPS, Tank, Healer, Buffer)
   */
  static async executeRaidAction(
    userId,
    username,
    actionType = "serang",
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

    const dbBoss = await WorldBoss.findOne({ where: { bossId: boss.bossId } });
    if (!dbBoss) return { success: false, reason: "BOSS_NOT_FOUND" };

    const currentHp = Number(dbBoss.currentHp);
    const maxHp = Number(dbBoss.maxHp);

    let currentPhase = dbBoss.phase || 1;
    let shieldHp = Number(dbBoss.shieldHp || 0);
    const roles = dbBoss.roleContributions || {
      tanks: {},
      healers: {},
      dps: {},
      buffers: {},
    };
    const leaderboard = dbBoss.damageLeaderboard || {};

    let damageDealt = 0;
    let shieldReduced = 0;
    let healAmount = 0;
    let buffAdded = 0;
    let isCrit = false;
    let message = "";

    // 1. Logika Aksi Sesuai Role
    if (actionType === "serang") {
      // DPS Action
      const baseDmg = Math.floor(Math.random() * 80) + 100 + userLevel * 6;
      const petDmg = petBuffs.damage || 0;
      const critChance = 15 + (petBuffs.crit || 0);
      isCrit = Math.random() * 100 < critChance;
      const critMult = isCrit ? (currentPhase === 3 ? 2.0 : 1.75) : 1.0;

      let effectiveDmg = Math.floor((baseDmg + petDmg) * critMult);

      // Jika fase shield sedang aktif, kurangi shield dulu
      if (currentPhase === 2 && shieldHp > 0) {
        if (shieldHp >= effectiveDmg) {
          shieldHp -= effectiveDmg;
          shieldReduced = effectiveDmg;
          effectiveDmg = 0;
        } else {
          effectiveDmg -= shieldHp;
          shieldReduced = shieldHp;
          shieldHp = 0;
          currentPhase = 1; // Shield pecah
        }
      }

      damageDealt = effectiveDmg;

      // Catat ke leaderboard
      if (!leaderboard[userId]) {
        leaderboard[userId] = { userId, username, totalDamage: 0, hits: 0 };
      }
      leaderboard[userId].totalDamage += damageDealt;
      leaderboard[userId].hits += 1;
      leaderboard[userId].username = username;

      if (!roles.dps[userId]) roles.dps[userId] = { hits: 0, totalDamage: 0 };
      roles.dps[userId].hits += 1;
      roles.dps[userId].totalDamage += damageDealt;

      const eCrit = ui.getEmoji("boss_strike") || "💥";
      const eHit = ui.getEmoji("battle") || "⚔️";
      message = isCrit
        ? `${eCrit} **${username}** melancarkan **Serangan Kritikal Kosmik Dahsyat**! (\`${damageDealt.toLocaleString("id-ID")}\` DMG)`
        : `${eHit} **${username}** menebas bos dengan presisi tinggi! (\`${damageDealt.toLocaleString("id-ID")}\` DMG)`;
    } else if (actionType === "shield") {
      // Tank Action: Meredam enrage dan menghancurkan armor bos
      const guardPower = Math.floor(Math.random() * 50) + 70 + userLevel * 4;
      if (currentPhase === 2 && shieldHp > 0) {
        const breakAmount = Math.min(shieldHp, guardPower * 2);
        shieldHp -= breakAmount;
        shieldReduced = breakAmount;
        if (shieldHp <= 0) {
          shieldHp = 0;
          currentPhase = 1;
        }
      }

      if (!roles.tanks[userId]) roles.tanks[userId] = { guards: 0, username };
      roles.tanks[userId].guards += 1;
      roles.tanks[userId].username = username;

      const eShield = ui.getEmoji("shield_defend") || "🛡️";
      message = `${eShield} **${username}** mengaktifkan **Cyber Aegis Barrier**, meredam serangan balasan bos untuk seluruh party!`;
    } else if (actionType === "heal") {
      // Healer Action: Memulihkan semangat tempur & stamina kolektif
      healAmount = Math.floor(Math.random() * 40) + 50 + userLevel * 3;
      if (!roles.healers[userId])
        roles.healers[userId] = { heals: 0, points: 0, username };
      roles.healers[userId].heals += 1;
      roles.healers[userId].points += healAmount;
      roles.healers[userId].username = username;

      const eHeal = ui.getEmoji("heal_aura") || "💖";
      message = `${eHeal} **${username}** memancarkan **Nano-Healing Sanctuary**, menyembuhkan stamina seluruh petualang!`;
    } else if (actionType === "buff") {
      // Buffer Action: Menaikkan drop pool bos
      buffAdded = Math.floor(Math.random() * 20) + 10;
      if (!roles.buffers[userId])
        roles.buffers[userId] = { buffs: 0, points: 0, username };
      roles.buffers[userId].buffs += 1;
      roles.buffers[userId].points += buffAdded;
      roles.buffers[userId].username = username;

      const currentPool = dbBoss.rewardsPool || {
        starFragments: 5000,
        coupons: 30,
      };
      currentPool.starFragments =
        (Number(currentPool.starFragments) || 5000) + buffAdded;
      dbBoss.rewardsPool = currentPool;
      dbBoss.changed("rewardsPool", true);

      const eStar = ui.getEmoji("star_resonance") || "🔮";
      message = `${eStar} **${username}** menyalurkan **Star Resonance**! Pool hadiah raid bertambah \`+${buffAdded}\` Star Fragments!`;
    }

    // 2. Evaluasi Transisi Fase (Phase 2 pada HP <= 50% bila belum pernah, Phase 3 pada HP <= 20%)
    const newHp = Math.max(0, currentHp - damageDealt);
    const newHpPercent = (newHp / maxHp) * 100;

    if (
      newHpPercent <= 50 &&
      newHpPercent > 20 &&
      currentPhase === 1 &&
      !dbBoss.shieldHp &&
      dbBoss.maxShieldHp > 0
    ) {
      currentPhase = 2; // Aktifkan Shield Phase
      shieldHp = Number(dbBoss.maxShieldHp);
    } else if (newHpPercent <= 20 && newHp > 0) {
      currentPhase = 3; // Enrage Phase (Bos mengamuk, damage lebih tinggi)
    }

    const isDefeated = newHp <= 0;
    if (isDefeated) {
      dbBoss.status = "DEFEATED";
      dbBoss.lastHitUserId = userId;

      // Cari MVP (total kontribusi damage tertinggi)
      const topDamage = Object.values(leaderboard).sort(
        (a, b) => b.totalDamage - a.totalDamage,
      )[0];
      if (topDamage) {
        dbBoss.mvpUserId = topDamage.userId;
      }
    }

    dbBoss.currentHp = newHp;
    dbBoss.phase = currentPhase;
    dbBoss.shieldHp = shieldHp;
    dbBoss.damageLeaderboard = leaderboard;
    dbBoss.roleContributions = roles;
    dbBoss.changed("damageLeaderboard", true);
    await dbBoss.save({
      fields: [
        "status",
        "defeatedAt",
        "mvpUserId",
        "currentHp",
        "phase",
        "shieldHp",
        "damageLeaderboard",
        "roleContributions",
      ],
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
          BOSS_CACHE_TTL,
        );
      }

      await redisManager.publish(RAID_CHANNEL, {
        type: isDefeated ? "DEFEATED" : "ACTION",
        actionType,
        userId,
        damage: damageDealt,
        currentHp: newHp,
        phase: currentPhase,
        shieldHp,
      });
    }

    return {
      success: true,
      actionType,
      damage: damageDealt,
      shieldReduced,
      healAmount,
      buffAdded,
      isCrit,
      bossName: dbBoss.name,
      currentHp: newHp,
      maxHp: dbBoss.maxHp,
      phase: currentPhase,
      shieldHp,
      isDefeated,
      userTotalDamage: leaderboard[userId]?.totalDamage || 0,
      message,
    };
  }

  /**
   * Helper kompatibilitas untuk serangan standar
   */
  static async attackBoss(userId, username, options) {
    return await this.executeRaidAction(userId, username, "serang", options);
  }

  /**
   * Bagikan hadiah raid secara proporsional kepada semua peran (DPS, Tank, Healer, Buffer)
   */
  static async _distributeRewards(boss) {
    try {
      const leaderboard = boss.damageLeaderboard || {};
      const participants = Object.values(leaderboard);
      const roles = boss.roleContributions || {};

      if (participants.length === 0) return;

      const totalPoolFrag = boss.rewardsPool?.starFragments || 5000;
      const totalPoolCoupons = boss.rewardsPool?.coupons || 30;
      const totalDmgDealt =
        participants.reduce((sum, p) => sum + (p.totalDamage || 0), 0) || 1;

      // 1. Payout kontribusi DPS
      for (const p of participants) {
        const share = p.totalDamage / totalDmgDealt;
        let rewardFrag = Math.max(50, Math.floor(totalPoolFrag * share * 0.7)); // 70% pool untuk DPS
        let rewardCoupons = Math.max(
          1,
          Math.floor(totalPoolCoupons * share * 0.7),
        );

        // Bonus MVP (1.5x)
        if (boss.mvpUserId && p.userId === boss.mvpUserId) {
          rewardFrag = Math.floor(rewardFrag * 1.5);
          rewardCoupons += 3;
        }

        // Bonus Last Hit (+500 Frag, +2 Coupons)
        if (boss.lastHitUserId && p.userId === boss.lastHitUserId) {
          rewardFrag += 500;
          rewardCoupons += 2;
        }

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
          `[WorldBoss 2.0 Reward] DPS ${p.userId} (${p.username}) dapat ${rewardFrag} Fragments, ${rewardCoupons} Coupons.`,
        );

        // Catat akumulasi damage all-time ke Redis Sorted Set
        if (redisManager.isReady && redisManager.client) {
          try {
            await redisManager.client.zIncrBy(
              "survival:boss:leaderboard:alltime",
              p.totalDamage,
              p.userId,
            );
            if (p.username) {
              await redisManager.client.hSet(
                "survival:boss:usernames",
                p.userId,
                p.username,
              );
            }
          } catch (_redisErr) {}
        }
      }

      // 2. Payout Tank & Healer & Buffer Support (30% pool)
      const supportUsers = new Set([
        ...Object.keys(roles.tanks || {}),
        ...Object.keys(roles.healers || {}),
        ...Object.keys(roles.buffers || {}),
      ]);

      const supportPoolFrag = Math.floor(totalPoolFrag * 0.3);
      const perSupportFrag = Math.max(
        100,
        Math.floor(supportPoolFrag / (supportUsers.size || 1)),
      );

      for (const uId of supportUsers) {
        await cacheManager.incrementUserSurvival(
          uId,
          "starFragments",
          perSupportFrag,
        );
        await cacheManager.incrementUserSurvival(uId, "coupons", 1);
        logger.info(
          `[WorldBoss 2.0 Support Reward] User ${uId} dapat ${perSupportFrag} Fragments, 1 Coupon.`,
        );
      }
    } catch (e) {
      logger.error("[WorldBoss 2.0] Gagal membagikan reward raid:", e);
    }
  }

  /**
   * Ambil papan peringkat All-Time penakluk World Boss
   * @param {number} limit
   * @returns {Promise<Array<{ userId: string, username: string, totalDamage: number }>>}
   */
  static async getAllTimeLeaderboard(limit = 10) {
    if (redisManager.isReady && redisManager.client) {
      try {
        const results = await redisManager.client.zRangeWithScores(
          "survival:boss:leaderboard:alltime",
          0,
          limit - 1,
          { REV: true },
        );
        if (results && results.length > 0) {
          const formatted = [];
          for (const item of results) {
            const username =
              (await redisManager.client.hGet(
                "survival:boss:usernames",
                item.value,
              )) || `Petualang (${item.value.slice(0, 5)})`;
            formatted.push({
              userId: item.value,
              username,
              totalDamage: Number(item.score) || 0,
            });
          }
          return formatted;
        }
      } catch (e) {
        logger.warn(
          "[WorldBoss] Gagal mengambil all-time leaderboard dari Redis:",
          e.message,
        );
      }
    }
    return [];
  }
}

module.exports = WorldBossEngine;
