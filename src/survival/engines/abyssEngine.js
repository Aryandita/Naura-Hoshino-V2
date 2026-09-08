"use strict";

const redisManager = require("../../managers/redisManager");
const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");
const ui = require("../../config/ui");

const ABYSS_PREFIX = "abyss:run:";

const RELICS_CATALOG = [
  {
    id: "vampiric_fang",
    name: "Vampiric Fang",
    get emoji() {
      return ui.getEmoji("drop") || "🩸";
    },
    desc: "+15% Lifesteal per Serangan",
  },
  {
    id: "overclock_core",
    name: "Overclocked Core",
    get emoji() {
      return ui.getEmoji("flash") || "⚡";
    },
    desc: "+25% Peluang Serangan Kritis",
  },
  {
    id: "sakura_shield",
    name: "Sakura Ward",
    get emoji() {
      return ui.getEmoji("flower") || "🌸";
    },
    desc: "+50 Shield Pertahanan di Awal Tempur",
  },
  {
    id: "phantom_cloak",
    name: "Phantom Cloak",
    get emoji() {
      return ui.getEmoji("shield") || "🧥";
    },
    desc: "+20% Peluang Menghindar (Dodge)",
  },
  {
    id: "star_resonator",
    name: "Astral Resonator",
    get emoji() {
      return ui.getEmoji("star") || "⭐";
    },
    desc: "+50% Bonus Perolehan Star Fragments",
  },
];

class AbyssEngine {
  /**
   * Mulai ekspedisi Rogue-lite Abyss baru
   */
  static async startRun(userId, userStats = {}) {
    const existing = await this.getRun(userId);
    if (existing && existing.status === "EXPLORING") {
      return { success: false, reason: "ALREADY_IN_RUN", run: existing };
    }

    const maxHp = Math.max(300, 100 + (userStats.level || 1) * 10);
    const runData = {
      userId,
      currentFloor: 1,
      maxHp,
      currentHp: maxHp,
      attackPower: 45,
      shield: 0,
      relics: [],
      fragmentsCollected: 0,
      status: "EXPLORING", // EXPLORING, RELIC_SELECT, VICTORY, DEFEATED
      availableChoices: this._generateChoices(1),
      startedAt: Date.now(),
    };

    if (redisManager.isReady) {
      await redisManager.setCache(
        `${ABYSS_PREFIX}${userId}`,
        JSON.stringify(runData),
        3600,
      );
    }

    logger.info(
      `[AbyssEngine] User ${userId} memulai ekspedisi The Neo-Abyss.`,
    );
    return runData;
  }

  /**
   * Ambil sesi run aktif
   */
  static async getRun(userId) {
    if (!redisManager.isReady) return null;
    const raw = await redisManager.getCache(`${ABYSS_PREFIX}${userId}`);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }

  /**
   * Hasilkan 3 pilihan ruangan bercabang untuk lantai saat ini
   */
  static _generateChoices(floor) {
    if (floor % 10 === 0) {
      return [
        {
          type: "GUARDIAN",
          label: `${ui.getEmoji("skull") || "👹"} Gerbang Penjaga Lantai ${floor}`,
          monsterName: `Abyss Sentinel Floor ${floor}`,
          hp: 150 + floor * 15,
          dmg: 20 + floor * 2,
        },
      ];
    }

    const types = ["COMBAT", "RELIC", "CAMPFIRE", "MYSTERY"];
    const choices = [];

    for (let i = 0; i < 3; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      if (type === "COMBAT") {
        choices.push({
          type,
          label: `${ui.getEmoji("battle") || "⚔️"} Ruang Monster Liar`,
          monsterName: "Cyber Phantom",
          hp: 60 + floor * 8,
          dmg: 12 + floor * 2,
        });
      } else if (type === "RELIC") {
        choices.push({
          type,
          label: `${ui.getEmoji("gift") || "🎁"} Peti Harta Relic`,
          reward: "RELIC_DROP",
        });
      } else if (type === "CAMPFIRE") {
        choices.push({
          type,
          label: `${ui.getEmoji("fire") || "🔥"} Api Unggun Pemulihan`,
          healPercent: 35,
        });
      } else {
        choices.push({
          type,
          label: `${ui.getEmoji("magic") || "🔮"} Air Mancur Misterius`,
          mysteryEvent: true,
        });
      }
    }

    return choices;
  }

  /**
   * Pilih dan proses ruangan
   */
  static async chooseRoom(userId, choiceIndex) {
    const run = await this.getRun(userId);
    if (!run || run.status !== "EXPLORING") {
      return { success: false, reason: "NO_ACTIVE_RUN" };
    }

    const choice = run.availableChoices[choiceIndex] || run.availableChoices[0];
    const outcome = { type: choice.type, log: "" };

    if (choice.type === "COMBAT" || choice.type === "GUARDIAN") {
      // Simulasi tempur singkat
      const hasCrit =
        run.relics.includes("overclock_core") && Math.random() < 0.4;
      const playerDmg = hasCrit
        ? Math.floor(run.attackPower * 1.8)
        : run.attackPower;
      const monsterDmg = Math.max(
        5,
        choice.dmg - (run.relics.includes("sakura_shield") ? 8 : 0),
      );

      const rounds = Math.ceil(choice.hp / playerDmg);
      const totalTaken = Math.max(0, rounds * monsterDmg);

      run.currentHp = Math.max(0, run.currentHp - totalTaken);
      const earnedFrag =
        (choice.type === "GUARDIAN" ? 150 : 35) *
        (run.relics.includes("star_resonator") ? 1.5 : 1);
      run.fragmentsCollected += Math.floor(earnedFrag);

      if (run.currentHp <= 0) {
        run.status = "DEFEATED";
        outcome.log = `${ui.getEmoji("skull") || "☠️"} Kamu gugur di tangan **${choice.monsterName}** di Lantai ${run.currentFloor}!`;
        await this._saveRun(userId, run);
        return { success: true, run, outcome, isFinished: true };
      }

      outcome.log = `${ui.getEmoji("battle") || "⚔️"} Kamu mengalahkan **${choice.monsterName}**! Menerima **+${Math.floor(earnedFrag)} ${ui.getEmoji("star") || "⭐"}** (Kerusakan diterima: -${totalTaken} HP)`;
    } else if (choice.type === "CAMPFIRE") {
      const healAmount = Math.floor(run.maxHp * 0.35);
      run.currentHp = Math.min(run.maxHp, run.currentHp + healAmount);
      outcome.log = `${ui.getEmoji("fire") || "🔥"} Kamu beristirahat di dekat api unggun. Memulihkan **+${healAmount} HP**!`;
    } else if (choice.type === "RELIC") {
      const uncollected = RELICS_CATALOG.filter(
        (r) => !run.relics.includes(r.id),
      );
      if (uncollected.length > 0) {
        const gainedRelic =
          uncollected[Math.floor(Math.random() * uncollected.length)];
        run.relics.push(gainedRelic.id);
        outcome.log = `${ui.getEmoji("gift") || "🎁"} Kamu menemukan Relic Kuno: **${gainedRelic.emoji} ${gainedRelic.name}** (*${gainedRelic.desc}*)!`;
      } else {
        run.fragmentsCollected += 100;
        outcome.log = `${ui.getEmoji("gift") || "🎁"} Seluruh Relic sudah kamu miliki! Mengonversikan menjadi **+100 ${ui.getEmoji("star") || "⭐"}**!`;
      }
    } else {
      // MYSTERY
      if (Math.random() < 0.5) {
        run.attackPower += 8;
        outcome.log = `${ui.getEmoji("magic") || "🔮"} Air mancur misterius memberkatimu dengan **+8 Attack Power Permanen**!`;
      } else {
        const bonusCoins = 75;
        run.fragmentsCollected += bonusCoins;
        outcome.log = `${ui.getEmoji("magic") || "🔮"} Kamu menemukan kantong koin tersembunyi berisi **+${bonusCoins} ${ui.getEmoji("star") || "⭐"}**!`;
      }
    }

    // Naik lantai
    run.currentFloor += 1;
    if (run.currentFloor > 50) {
      run.status = "VICTORY";
      outcome.log += `\n\n${ui.getEmoji("celebrate") || "🎉"} **SELAMAT! KAMU TELAH MENAKLUKKAN SELURUH 50 LANTAI THE NEO-ABYSS!**`;
      await cacheManager.incrementUserSurvival(
        userId,
        "starFragments",
        run.fragmentsCollected + 1000,
      );
      await this._saveRun(userId, run);
      return { success: true, run, outcome, isFinished: true };
    }

    run.availableChoices = this._generateChoices(run.currentFloor);
    await this._saveRun(userId, run);

    return {
      success: true,
      run,
      outcome,
      isFinished: false,
    };
  }

  /**
   * Selesaikan run dan klaim hadiah yang terkumpul
   */
  static async finishRun(userId) {
    const run = await this.getRun(userId);
    if (!run) return { success: false, reason: "NO_ACTIVE_RUN" };

    const totalCoins = run.fragmentsCollected;
    if (totalCoins > 0) {
      await cacheManager.incrementUserSurvival(
        userId,
        "starFragments",
        totalCoins,
      );
    }

    if (redisManager.isReady) {
      await redisManager.deleteCache(`${ABYSS_PREFIX}${userId}`);
    }

    return {
      success: true,
      floorsCleared: run.currentFloor - 1,
      totalCoins,
      relicsGained: run.relics.length,
    };
  }

  static async _saveRun(userId, run) {
    if (redisManager.isReady) {
      await redisManager.setCache(
        `${ABYSS_PREFIX}${userId}`,
        JSON.stringify(run),
        3600,
      );
    }
  }
}

module.exports = AbyssEngine;
